"""
main.py – FastAPI application entry point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from pathlib import Path

import time
import logging
from sqlalchemy.exc import OperationalError
from sqlalchemy import text

from app.core.config import settings
from app.api.v1.router import api_router
from app.db.base import Base  # noqa: F401 – ensure all models are registered
from app.db.session import get_engine
from app.core.rate_limit import init_rate_limiting
from app.db.init_db import initialize_system
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize RAG service (load models)
    logger.info("Lifespan: Initializing services...")
    try:
        from app.services.rag_service import rag_service
        rag_service.initialize()
        
        # Ensure directory for generated docs exists
        generated_docs_dir = Path("uploads/generated_docs")
        generated_docs_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Initialized storage at {generated_docs_dir}")
        
    except Exception as e:
        logger.error(f"Failed to initialize RAG service during startup: {e}")
    
    yield
    # Shutdown: Cleanup if needed
    logger.info("Lifespan: Shutting down...")

# ── Config Logging ──────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ── Create tables with retry logic ───────────────────────────
max_retries = 10
retry_delay = 3

for attempt in range(max_retries):
    try:
        logger.info(f"Connecting to database (Attempt {attempt + 1}/{max_retries})...")
        Base.metadata.create_all(bind=get_engine())
        initialize_system()
        logger.info("Database connection successful. System initialized.")
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
    lifespan=lifespan,
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
