from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from app.core.database import get_db, Connection, SearchLog
from app.services.indexer import (
    build_index, search_index, delete_index,
    read_table_rows, get_sqlite_tables, get_table_row_count, index_exists
)
from app.services.demo_db import seed_demo_db, get_demo_tables, get_demo_table_info, DEMO_DB_PATH
import asyncio

router = APIRouter()


# ── Connection models ────────────────────────────────────────────────────────
class CreateConnectionRequest(BaseModel):
    name: str
    db_type: str = "demo"        # "demo" | "sqlite"
    connection_string: Optional[str] = None   # path for sqlite


class SearchRequest(BaseModel):
    query: str
    table: str
    top_k: int = 10


# ── Helpers ──────────────────────────────────────────────────────────────────
def _conn_dict(c: Connection) -> dict:
    return {
        "id": c.id, "name": c.name, "db_type": c.db_type,
        "tables": c.tables, "total_rows": c.total_rows,
        "index_status": c.index_status, "index_error": c.index_error,
        "embed_model": c.embed_model, "created_at": c.created_at,
        "indexed_at": c.indexed_at,
    }


async def _do_index(connection_id: str, db_type: str, db_path: str, tables: list[str]):
    """Background indexing task."""
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        conn = await db.get(Connection, connection_id)
        if not conn:
            return
        conn.index_status = "indexing"
        await db.commit()

    try:
        total = 0
        loop = asyncio.get_event_loop()
        for table in tables:
            # Read rows in thread pool (blocking I/O)
            rows = await loop.run_in_executor(None, read_table_rows, db_path, table, 100000)
            # Build index in thread pool (CPU intensive)
            await loop.run_in_executor(None, build_index, connection_id, table, rows)
            total += len(rows)

        async with AsyncSessionLocal() as db:
            conn = await db.get(Connection, connection_id)
            conn.index_status = "ready"
            conn.total_rows = total
            conn.indexed_at = datetime.now(timezone.utc)
            await db.commit()
    except Exception as e:
        async with AsyncSessionLocal() as db:
            conn = await db.get(Connection, connection_id)
            conn.index_status = "error"
            conn.index_error = str(e)
            await db.commit()


# ── Connections ──────────────────────────────────────────────────────────────
@router.post("/connections")
async def create_connection(
    req: CreateConnectionRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    if req.db_type == "demo":
        db_path = seed_demo_db()
        tables = get_demo_tables()
        total = sum(v["rows"] for v in get_demo_table_info().values())
    elif req.db_type == "sqlite":
        if not req.connection_string:
            raise HTTPException(400, "connection_string required for sqlite")
        db_path = req.connection_string
        try:
            tables = get_sqlite_tables(db_path)
            if not tables:
                raise HTTPException(422, "No tables found in database")
            total = sum(get_table_row_count(db_path, t) for t in tables)
        except Exception as e:
            raise HTTPException(422, f"Could not connect to database: {e}")
    else:
        raise HTTPException(400, "db_type must be 'demo' or 'sqlite'")

    conn = Connection(
        name=req.name, db_type=req.db_type,
        connection_string=db_path if req.db_type == "sqlite" else None,
        tables=tables, total_rows=total,
        index_status="pending", embed_model="all-MiniLM-L6-v2",
    )
    db.add(conn)
    await db.commit()
    await db.refresh(conn)

    background_tasks.add_task(_do_index, conn.id, req.db_type, db_path, tables)

    return _conn_dict(conn)


@router.get("/connections")
async def list_connections(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Connection).order_by(desc(Connection.created_at)))
    return [_conn_dict(c) for c in res.scalars().all()]


@router.get("/connections/{conn_id}")
async def get_connection(conn_id: str, db: AsyncSession = Depends(get_db)):
    c = await db.get(Connection, conn_id)
    if not c:
        raise HTTPException(404)
    return _conn_dict(c)


@router.delete("/connections/{conn_id}")
async def delete_connection(conn_id: str, db: AsyncSession = Depends(get_db)):
    c = await db.get(Connection, conn_id)
    if not c:
        raise HTTPException(404)
    for table in (c.tables or []):
        delete_index(conn_id, table)
    await db.delete(c)
    await db.commit()
    return {"deleted": True}


# ── Search ───────────────────────────────────────────────────────────────────
@router.post("/connections/{conn_id}/search")
async def search(conn_id: str, req: SearchRequest, db: AsyncSession = Depends(get_db)):
    c = await db.get(Connection, conn_id)
    if not c:
        raise HTTPException(404, "Connection not found")
    if c.index_status != "ready":
        raise HTTPException(422, f"Index not ready. Status: {c.index_status}")
    if req.table not in (c.tables or []):
        raise HTTPException(400, f"Table '{req.table}' not in this connection")

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, search_index, conn_id, req.table, req.query, req.top_k)

    if result.get("error"):
        raise HTTPException(422, result["error"])

    # Log search
    log = SearchLog(
        connection_id=conn_id, query=req.query,
        results_count=len(result["results"]),
        search_ms=result["search_ms"],
    )
    db.add(log)
    await db.commit()

    return result


# ── Benchmark ────────────────────────────────────────────────────────────────
@router.get("/connections/{conn_id}/benchmark")
async def benchmark(conn_id: str, table: str, db: AsyncSession = Depends(get_db)):
    """Run 5 benchmark queries and return average search time."""
    c = await db.get(Connection, conn_id)
    if not c or c.index_status != "ready":
        raise HTTPException(422, "Index not ready")
    if table not in (c.tables or []):
        raise HTTPException(400, "Table not found")

    queries = [
        "customer complaint about damaged product",
        "payment processing error billing issue",
        "account login authentication problem",
        "shipping delivery delay tracking",
        "refund request return policy",
    ]

    loop = asyncio.get_event_loop()
    times = []
    for q in queries:
        result = await loop.run_in_executor(None, search_index, conn_id, table, q, 5)
        times.append(result["search_ms"])

    return {
        "table": table,
        "total_rows": result.get("total_rows", 0),
        "queries_run": len(queries),
        "avg_ms": round(sum(times) / len(times), 2),
        "min_ms": round(min(times), 2),
        "max_ms": round(max(times), 2),
        "times_ms": [round(t, 2) for t in times],
    }


# ── Demo info ────────────────────────────────────────────────────────────────
@router.get("/demo/info")
async def demo_info():
    return {
        "tables": get_demo_table_info(),
        "total_rows": sum(v["rows"] for v in get_demo_table_info().values()),
        "description": "Pre-loaded demo database with support tickets, products, employees and news articles",
    }


# ── Search history ───────────────────────────────────────────────────────────
@router.get("/connections/{conn_id}/history")
async def search_history(conn_id: str, limit: int = 20, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(SearchLog)
        .where(SearchLog.connection_id == conn_id)
        .order_by(desc(SearchLog.created_at))
        .limit(limit)
    )
    return [{"id": l.id, "query": l.query, "results_count": l.results_count,
             "search_ms": l.search_ms, "created_at": l.created_at}
            for l in res.scalars().all()]
