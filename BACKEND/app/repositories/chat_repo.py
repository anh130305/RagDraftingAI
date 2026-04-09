"""
repositories.chat_repo – Chat session & message data access.
"""

from typing import Optional, List
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import desc, asc

from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.repositories.base_repo import BaseRepository


# ── Session Repository ───────────────────────────────────────

class ChatSessionRepository(BaseRepository[ChatSession]):
    def __init__(self):
        super().__init__(ChatSession)

    def get_by_user(
        self,
        db: Session,
        user_id: UUID,
        *,
        include_archived: bool = False,
        skip: int = 0,
        limit: int = 50,
    ) -> List[ChatSession]:
        q = db.query(ChatSession).filter(ChatSession.user_id == user_id)
        if not include_archived:
            q = q.filter(ChatSession.is_archived == False)  # noqa: E712
        return q.order_by(desc(ChatSession.updated_at)).offset(skip).limit(limit).all()

    def archive(self, db: Session, session: ChatSession) -> ChatSession:
        session.is_archived = True
        db.commit()
        db.refresh(session)
        return session


# ── Message Repository ───────────────────────────────────────

class ChatMessageRepository(BaseRepository[ChatMessage]):
    def __init__(self):
        super().__init__(ChatMessage)

    def get_by_session(
        self,
        db: Session,
        session_id: UUID,
        *,
        skip: int = 0,
        limit: int = 200,
    ) -> List[ChatMessage]:
        return (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id == session_id)
            .order_by(asc(ChatMessage.created_at))
            .offset(skip)
            .limit(limit)
            .all()
        )


# Singleton instances
session_repo = ChatSessionRepository()
message_repo = ChatMessageRepository()
