"""
ChatSession model
Each session belongs to a user and contains many messages.
"""

import uuid

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.session import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String, nullable=True)
    is_archived = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # ── Relationships ───────────────────────────────────────────
    user = relationship("User", back_populates="chat_sessions")
    messages = relationship(
        "ChatMessage", back_populates="session", cascade="all, delete-orphan",
        passive_deletes=True, order_by="ChatMessage.created_at.asc()",
    )
    query_logs = relationship(
        "QueryLog", back_populates="session",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<ChatSession {self.id}  title={self.title!r}>"
