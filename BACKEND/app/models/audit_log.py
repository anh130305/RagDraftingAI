"""
AuditLog model
"""

import enum
import uuid

from sqlalchemy import Column, String, Enum, DateTime, JSON, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy import ForeignKey

from app.db.session import Base


class AuditAction(str, enum.Enum):
    """All auditable actions in the system."""
    login = "login"
    logout = "logout"
    upload_document = "upload_document"
    delete_document = "delete_document"
    query = "query"
    create_session = "create_session"
    delete_session = "delete_session"
    update_user = "update_user"
    download_document = "download_document"
    storage_error = "storage_error"

    # Prompt Templates
    create_template = "create_template"
    update_template = "update_template"
    delete_template = "delete_template"
    use_template = "use_template"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action = Column(
        Enum(AuditAction, name="audit_action", create_type=False),
        nullable=False,
    )
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    ip_address = Column(String(45), nullable=True)  # IPv4/IPv6 as string — works on all DBs
    detail = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    # ── Relationships ───────────────────────────────────────────
    user = relationship("User", back_populates="audit_logs")

    @property
    def user_name(self) -> str | None:
        if not self.user:
            return None
        return self.user.username or self.user.email

    def __repr__(self) -> str:
        return f"<AuditLog action={self.action.value}  user_id={self.user_id}>"
