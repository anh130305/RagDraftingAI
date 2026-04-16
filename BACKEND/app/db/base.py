"""
db.base – Import all models so Alembic can detect them.

When running `alembic revision --autogenerate`, Alembic inspects
`Base.metadata` to discover tables.  Models must be imported *before*
the metadata is read — this module ensures that happens.

Usage in alembic/env.py:
    from app.db.base import Base   # noqa: F401
"""

# Re-export the Base that every model inherits from
from app.db.session import Base  # noqa: F401

# Import every model so its table is registered on Base.metadata
from app.models.user import User  # noqa: F401
from app.models.audit_log import AuditLog  # noqa: F401
from app.models.chat_session import ChatSession  # noqa: F401
from app.models.chat_message import ChatMessage  # noqa: F401
from app.models.document import Document  # noqa: F401
from app.models.query_log import QueryLog  # noqa: F401
