"""
services.chat_service – Chat session and message orchestration.
"""

from typing import List
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, ForbiddenError
from app.repositories.chat_repo import session_repo, message_repo
from app.models.chat_message import MessageRole
from app.schemas.chat import (
    ChatSessionCreate,
    ChatSessionUpdate,
    ChatSessionResponse,
    ChatMessageCreate,
    ChatMessageResponse,
    ChatSessionWithMessages,
)


# ── Sessions ─────────────────────────────────────────────────

def create_session(
    db: Session, user_id: UUID, payload: ChatSessionCreate
) -> ChatSessionResponse:
    s = session_repo.create(db, obj_in={"user_id": user_id, "title": payload.title})
    return ChatSessionResponse.model_validate(s)


def list_sessions(
    db: Session,
    user_id: UUID,
    *,
    include_archived: bool = False,
    skip: int = 0,
    limit: int = 50,
) -> List[ChatSessionResponse]:
    sessions = session_repo.get_by_user(
        db, user_id, include_archived=include_archived, skip=skip, limit=limit
    )
    return [ChatSessionResponse.model_validate(s) for s in sessions]


def get_session(db: Session, session_id: UUID, user_id: UUID) -> ChatSessionWithMessages:
    s = session_repo.get_by_id(db, session_id)
    if not s:
        raise NotFoundError("Chat session")
    if s.user_id != user_id:
        raise ForbiddenError("You do not own this session")
    msgs = message_repo.get_by_session(db, session_id)
    return ChatSessionWithMessages(
        **ChatSessionResponse.model_validate(s).model_dump(),
        messages=[ChatMessageResponse.model_validate(m) for m in msgs],
    )


def update_session(
    db: Session, session_id: UUID, user_id: UUID, payload: ChatSessionUpdate
) -> ChatSessionResponse:
    s = session_repo.get_by_id(db, session_id)
    if not s:
        raise NotFoundError("Chat session")
    if s.user_id != user_id:
        raise ForbiddenError("You do not own this session")
    updated = session_repo.update(db, db_obj=s, obj_in=payload.model_dump(exclude_unset=True))
    return ChatSessionResponse.model_validate(updated)


def delete_session(db: Session, session_id: UUID, user_id: UUID) -> None:
    s = session_repo.get_by_id(db, session_id)
    if not s:
        raise NotFoundError("Chat session")
    if s.user_id != user_id:
        raise ForbiddenError("You do not own this session")
    session_repo.delete(db, id=session_id)


# ── Messages ─────────────────────────────────────────────────

def add_message(
    db: Session,
    session_id: UUID,
    user_id: UUID,
    payload: ChatMessageCreate,
) -> ChatMessageResponse:
    """Add a user message.  Assistant reply will be added separately (via RAG)."""
    s = session_repo.get_by_id(db, session_id)
    if not s:
        raise NotFoundError("Chat session")
    if s.user_id != user_id:
        raise ForbiddenError("You do not own this session")

    msg = message_repo.create(
        db,
        obj_in={
            "session_id": session_id,
            "role": MessageRole.user,
            "content": payload.content,
        },
    )
    return ChatMessageResponse.model_validate(msg)


def get_messages(
    db: Session, session_id: UUID, user_id: UUID
) -> List[ChatMessageResponse]:
    s = session_repo.get_by_id(db, session_id)
    if not s:
        raise NotFoundError("Chat session")
    if s.user_id != user_id:
        raise ForbiddenError("You do not own this session")
    msgs = message_repo.get_by_session(db, session_id)
    return [ChatMessageResponse.model_validate(m) for m in msgs]
