"""
FAISS-based vector indexer.
- Reads rows from any SQLite/PostgreSQL table
- Embeds text using Sentence Transformers
- Builds FAISS IVF index for fast ANN search
- Stores index + metadata on disk
"""
import os
import json
import time
import sqlite3
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
from app.core.config import settings

os.makedirs(settings.FAISS_INDEX_PATH, exist_ok=True)

# Lazy-load model once
_model = None

def get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer(settings.EMBEDDING_MODEL)
    return _model


def _row_to_text(row: dict) -> str:
    """Convert a database row to searchable text."""
    parts = []
    for k, v in row.items():
        if v is not None and k not in ("id", "created_at", "updated_at", "indexed_at"):
            parts.append(f"{k}: {str(v)}")
    return " | ".join(parts)


def _index_path(connection_id: str, table: str) -> str:
    return os.path.join(settings.FAISS_INDEX_PATH, f"{connection_id}_{table}")


def index_exists(connection_id: str, table: str) -> bool:
    p = _index_path(connection_id, table)
    return os.path.exists(p + ".faiss") and os.path.exists(p + ".meta.json")


def build_index(connection_id: str, table: str, rows: list[dict], batch_size: int = 512) -> dict:
    """
    Build FAISS index for a table's rows.
    Returns: { rows_indexed, index_size_mb, build_time_ms }
    """
    if not rows:
        return {"rows_indexed": 0, "index_size_mb": 0, "build_time_ms": 0}

    model = get_model()
    t0 = time.time()

    # Convert rows to text
    texts = [_row_to_text(r) for r in rows]

    # Embed in batches
    all_embeddings = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i+batch_size]
        embs = model.encode(batch, show_progress_bar=False, convert_to_numpy=True)
        all_embeddings.append(embs)

    embeddings = np.vstack(all_embeddings).astype("float32")
    d = embeddings.shape[1]  # dimension (384 for MiniLM)

    # Normalize for cosine similarity
    faiss.normalize_L2(embeddings)

    # Build index — use IVF for large datasets, Flat for small
    n = len(rows)
    if n > 10000:
        nlist = min(int(np.sqrt(n)), 256)
        quantizer = faiss.IndexFlatIP(d)
        index = faiss.IndexIVFFlat(quantizer, d, nlist, faiss.METRIC_INNER_PRODUCT)
        index.train(embeddings)
    else:
        index = faiss.IndexFlatIP(d)

    index.add(embeddings)

    # Save index
    p = _index_path(connection_id, table)
    faiss.write_index(index, p + ".faiss")

    # Save metadata (row IDs and display text)
    meta = {
        "rows": [{"id": r.get("id", i), "text": texts[i], "data": r} for i, r in enumerate(rows)],
        "count": n,
        "dimension": d,
    }
    with open(p + ".meta.json", "w") as f:
        json.dump(meta, f)

    build_ms = (time.time() - t0) * 1000
    size_mb = os.path.getsize(p + ".faiss") / (1024 * 1024)

    return {
        "rows_indexed": n,
        "index_size_mb": round(size_mb, 2),
        "build_time_ms": round(build_ms),
    }


def search_index(connection_id: str, table: str, query: str, top_k: int = 10) -> dict:
    """
    Search the FAISS index for a query.
    Returns: { results: [...], search_ms, total_rows }
    """
    p = _index_path(connection_id, table)
    if not os.path.exists(p + ".faiss"):
        return {"results": [], "search_ms": 0, "total_rows": 0, "error": "Index not built"}

    t0 = time.time()
    model = get_model()

    # Embed query
    q_emb = model.encode([query], convert_to_numpy=True).astype("float32")
    faiss.normalize_L2(q_emb)

    # Load index
    index = faiss.read_index(p + ".faiss")
    if hasattr(index, 'nprobe'):
        index.nprobe = min(10, index.nlist)

    # Search
    scores, indices = index.search(q_emb, min(top_k, index.ntotal))

    # Load metadata
    with open(p + ".meta.json") as f:
        meta = json.load(f)

    rows_meta = meta["rows"]
    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx < 0 or idx >= len(rows_meta):
            continue
        row = rows_meta[idx]
        results.append({
            "score": round(float(score), 4),
            "id": row["id"],
            "data": row["data"],
            "preview": row["text"][:200],
        })

    search_ms = (time.time() - t0) * 1000

    return {
        "results": results,
        "search_ms": round(search_ms, 2),
        "total_rows": meta["count"],
    }


def delete_index(connection_id: str, table: str):
    p = _index_path(connection_id, table)
    for ext in [".faiss", ".meta.json"]:
        if os.path.exists(p + ext):
            os.remove(p + ext)


def read_table_rows(db_path: str, table: str, limit: int = None) -> list[dict]:
    """Read rows from a SQLite table."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    q = f"SELECT * FROM {table}"
    if limit:
        q += f" LIMIT {limit}"
    cur.execute(q)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def get_sqlite_tables(db_path: str) -> list[str]:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    tables = [r[0] for r in cur.fetchall()]
    conn.close()
    return tables


def get_table_row_count(db_path: str, table: str) -> int:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute(f"SELECT COUNT(*) FROM {table}")
    count = cur.fetchone()[0]
    conn.close()
    return count
