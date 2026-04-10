"""
db.session – SQLAlchemy engine and session factory.

Uses centralised Settings from core.config for database URL.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import settings

# ── Declarative Base ─────────────────────────────────────────
# All models inherit from this. Imported by db/base.py to register tables.
Base = declarative_base()

# ── Engine & Session ─────────────────────────────────────────
# Engine creation is deferred to allow test overrides of DATABASE_URL.
# psycopg2 is only required when actually connecting to PostgreSQL.

_engine = None
_SessionLocal = None


def get_engine():
    global _engine
    if _engine is None:
        print(f"DEBUG: Connecting to database at: {settings.DATABASE_URL.split('@')[-1]}")
        _engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    return _engine


def get_session_local():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=get_engine()
        )
    return _SessionLocal


# Backward-compatible aliases
@property
def engine():
    return get_engine()


@property
def SessionLocal():
    return get_session_local()
