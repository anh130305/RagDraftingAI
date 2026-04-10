"""
ChatMessage model
Each message belongs to a chat session and stores role + content.
"""

import enum
import uuid

from sqlalchemy import Column, String, Integer, Enum, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.session import Base


class MessageRole(str, enum.Enum):
    """Who sent the message."""
    user = "user"
    assistant = "assistant"
    system = "system"


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(
        Enum(MessageRole, name="message_role", create_type=False),
        nullable=False,
    )
    content = Column(String, nullable=False)
    feedback = Column(String, nullable=True)  # 'like' or 'dislike'
    token_count = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    # ── Relationships ───────────────────────────────────────────
    session = relationship("ChatSession", back_populates="messages")
    query_logs = relationship(
        "QueryLog", back_populates="message",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<ChatMessage role={self.role.value}  session={self.session_id}>"
