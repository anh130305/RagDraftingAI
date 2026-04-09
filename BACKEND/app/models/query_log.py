"""
QueryLog model
Lightweight record linking a chat message to its RAG retrieval metrics.
Full query text and retrieved chunk IDs live in the RAG service.
"""

import uuid

from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.session import Base


class QueryLog(Base):
    __tablename__ = "query_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    message_id = Column(
        UUID(as_uuid=True),
        ForeignKey("chat_messages.id", ondelete="SET NULL"),
        nullable=True,
    )
    response_time_ms = Column(Integer, nullable=True)
    chunk_found = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    # ── Relationships ───────────────────────────────────────────
    session = relationship("ChatSession", back_populates="query_logs")
    message = relationship("ChatMessage", back_populates="query_logs")

    def __repr__(self) -> str:
        return (
            f"<QueryLog session={self.session_id}  "
            f"time={self.response_time_ms}ms  found={self.chunk_found}>"
        )
