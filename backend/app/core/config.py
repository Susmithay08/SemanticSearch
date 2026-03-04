from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./semanticsearch.db"
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    FAISS_INDEX_PATH: str = "./faiss_indexes"
    FRONTEND_URL: str = "http://localhost:5173"
    MAX_ROWS_PER_TABLE: int = 100000

    class Config:
        env_file = ".env"

settings = Settings()
