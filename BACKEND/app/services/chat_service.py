"""
services.chat_service – Chat session and message orchestration.
"""

from typing import List
from uuid import UUID
from sqlalchemy.sql import func


from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, ForbiddenError
from app.repositories.chat_repo import session_repo, message_repo
from app.services import cloudinary_service
from app.models.document import Document
from app.models.chat_message import MessageRole
from app.models.chat_message import ChatMessage
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
    
    # Broad cleanup on Cloudinary: delete the entire folder for this session.
    # Storage cleanup should not block DB deletion if it fails.
    try:
        cloudinary_service.delete_session_folder(str(user_id), str(session_id))
    except Exception:
        pass

    # Clean up associated documents in DB (cascades to chunks)
    db.query(Document).filter(Document.session_id == session_id).delete(synchronize_session=False)

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
    
    # Explicitly update the session timestamp to push it to the top of Recent Chats
    s.updated_at = func.now()
    db.commit()
    
    return ChatMessageResponse.model_validate(msg)

# mock AI rep, support FE test
def add_mock_assistant_message(
    db: Session,
    session_id: UUID,
    user_id: UUID,
) -> ChatMessageResponse:
    """Add a mock assistant message for testing purposes."""
    s = session_repo.get_by_id(db, session_id)
    if not s:
        raise NotFoundError("Chat session")
    if s.user_id != user_id:
        raise ForbiddenError("You do not own this session")

    msg = message_repo.create(
        db,
        obj_in={
            "session_id": session_id,
            "role": MessageRole.assistant,
            "content": "OKE! Tôi đã xử lý xong yêu cầu của bạn. Đây là phản hồi giả lập sau 10 giây chờ đợi.",
        },
    )
    
    s.updated_at = func.now()
    db.commit()
    
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

def update_message_feedback(
    db: Session, message_id: UUID, user_id: UUID, feedback_data: str | None
) -> ChatMessageResponse:
    msg = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not msg:
        raise NotFoundError("Chat message")
    
    s = session_repo.get_by_id(db, msg.session_id)
    if not s or s.user_id != user_id:
        raise ForbiddenError("You do not own this message")
    
    msg.feedback = feedback_data
    db.commit()
    db.refresh(msg)
    return ChatMessageResponse.model_validate(msg)
