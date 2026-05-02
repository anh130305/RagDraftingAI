from typing import Optional, Union, List
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application-wide configuration.  All values can be overridden via env vars."""

    # ── Application ──────────────────────────────────────────
    APP_NAME: str = "RagDraftingAI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # ── Database ─────────────────────────────────────────────
    DATABASE_URL: str = "postgresql://postgres:admin@localhost:5432/rag_db"

    # ── JWT / Auth ───────────────────────────────────────────
    SECRET_KEY: str = "change-me-in-production"
    INTERNAL_API_KEY: str = "internal-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ── CORS ─────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # ── RAG Service ──────────────────────────────────────────
    RAG_SERVICE_URL: str = "http://localhost:8001"
    RAG_REBUILD_SERVICE_URL: str = "http://localhost:8001"

    # ── Google OAuth ─────────────────────────────────────────
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/google/callback"

    # ── Cloudinary ───────────────────────────────────────────
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None

    # ── RAG Integration ──────────────────────────────────────
    RAG_ROOT_PATH: str = "/RAG"
    
    # ── LLM Providers ────────────────────────────────────────
    GROQ_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    LLM_MODEL: Optional[str] = None

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


# Singleton instance – import this everywhere
settings = Settings()
