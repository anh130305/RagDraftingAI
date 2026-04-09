"""
User model
"""

import enum
import uuid

from sqlalchemy import Column, String, Boolean, Enum, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.session import Base


class UserRole(str, enum.Enum):
    """Roles available in the system."""
    admin = "admin"
    user = "user"
    moderator = "moderator"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=True, index=True)
    google_id = Column(String(255), unique=True, nullable=True, index=True)
    password_hash = Column(String, nullable=True)
    role = Column(
        Enum(UserRole, name="user_role", create_type=False),
        nullable=False,
        default=UserRole.user,
    )
    department = Column(String(100), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # ── Relationships ───────────────────────────────────────────
    audit_logs = relationship(
        "AuditLog", back_populates="user", cascade="all, delete-orphan",
        passive_deletes=True,
    )
    chat_sessions = relationship(
        "ChatSession", back_populates="user", cascade="all, delete-orphan",
        passive_deletes=True,
    )
    documents = relationship(
        "Document", back_populates="uploaded_by_user",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<User {self.username!r}  role={self.role.value}>"
