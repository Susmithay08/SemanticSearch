from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, String, DateTime, Text, Integer, JSON, Float, Boolean
from datetime import datetime, timezone
import uuid
from app.core.config import settings


class Base(DeclarativeBase):
    pass


class Connection(Base):
    __tablename__ = "connections"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    db_type = Column(String, nullable=False)       # "demo" | "sqlite" | "postgresql"
    connection_string = Column(String, nullable=True)
    tables = Column(JSON, nullable=True)           # list of indexed table names
    total_rows = Column(Integer, default=0)
    index_status = Column(String, default="pending")  # pending|indexing|ready|error
    index_error = Column(Text, nullable=True)
    embed_model = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    indexed_at = Column(DateTime, nullable=True)


class SearchLog(Base):
    __tablename__ = "search_logs"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    connection_id = Column(String, nullable=False)
    query = Column(Text, nullable=False)
    results_count = Column(Integer, default=0)
    search_ms = Column(Float, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
