"""
app.models – SQLAlchemy ORM models.

Import all models here so they can be accessed via `from app.models import ...`.
"""

from app.models.user import User, UserRole
from app.models.audit_log import AuditLog, AuditAction
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage, MessageRole
from app.models.document import Document, DocStatus
from app.models.query_log import QueryLog
from app.models.prompt_template import PromptTemplate

__all__ = [
    # Models
    "User",
    "AuditLog",
    "ChatSession",
    "ChatMessage",
    "Document",
    "QueryLog",
    "PromptTemplate",
    # Enums
    "UserRole",
    "AuditAction",
    "MessageRole",
    "DocStatus",
]
