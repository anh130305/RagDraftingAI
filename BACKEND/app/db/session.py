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
        if settings.USE_CLOUD_DB and settings.CLOUD_DATABASE_URL:
            try:
                print(f"DEBUG: Attempting to connect to Cloud Database at: {settings.CLOUD_DATABASE_URL.split('@')[-1]}")
                connect_args = {}
                if settings.CLOUD_DB_SSL_CA:
                    connect_args["sslrootcert"] = settings.CLOUD_DB_SSL_CA
                if settings.CLOUD_DB_SSL_CERT:
                    connect_args["sslcert"] = settings.CLOUD_DB_SSL_CERT
                if settings.CLOUD_DB_SSL_KEY:
                    connect_args["sslkey"] = settings.CLOUD_DB_SSL_KEY
                if connect_args:
                    connect_args["sslmode"] = "verify-ca"
                
                _cloud_engine = create_engine(settings.CLOUD_DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
                # Test connection early
                with _cloud_engine.connect() as conn:
                    pass
                _engine = _cloud_engine
                print("DEBUG: Successfully connected to Cloud Database.")
            except Exception as e:
                print(f"WARNING: Failed to connect to Cloud Database: {e}")
                print("DEBUG: Falling back to Local Database.")
                _engine = None
        
        if _engine is None:
            print(f"DEBUG: Connecting to Local database at: {settings.DATABASE_URL.split('@')[-1]}")
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
def engine():
    return get_engine()


def SessionLocal():
    return get_session_local()
