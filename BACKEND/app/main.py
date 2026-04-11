"""
main.py – FastAPI application entry point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

import time
import logging
from sqlalchemy.exc import OperationalError
from sqlalchemy import text

from app.core.config import settings
from app.api.v1.router import api_router
from app.db.base import Base  # noqa: F401 – ensure all models are registered
from app.db.session import get_engine
from app.core.rate_limit import init_rate_limiting

# ── Config Logging ──────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def ensure_runtime_schema() -> None:
    """Apply safe, idempotent schema fixes for existing deployments."""
    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_documents_session_id "
                "ON documents (session_id)"
            )
        )

# ── Create tables with retry logic ───────────────────────────
max_retries = 10
retry_delay = 3

for attempt in range(max_retries):
    try:
        logger.info(f"Connecting to database (Attempt {attempt + 1}/{max_retries})...")
        Base.metadata.create_all(bind=get_engine())
        ensure_runtime_schema()
        logger.info("Database connection successful. Tables verified.")
        break
    except OperationalError as e:
        if attempt < max_retries - 1:
            logger.warning(f"Database not ready ({e}). Retrying in {retry_delay}s...")
            time.sleep(retry_delay)
        else:
            logger.error("Max retries reached. Could not connect to database.")
            raise e

# ── App ──────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

init_rate_limiting(app)

# ── CORS ─────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static Files ─────────────────────────────────────────────
os.makedirs("uploads", exist_ok=True)
app.mount("/api/v1/uploads", StaticFiles(directory="uploads"), name="uploads")

# ── Routes ───────────────────────────────────────────────────
app.include_router(api_router)


@app.get("/", tags=["Root"])
def read_root():
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }
