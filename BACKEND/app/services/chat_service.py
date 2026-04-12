"""
services.chat_service – Chat session and message orchestration.
"""

from typing import List
from uuid import UUID
import asyncio
import random
import time
from sqlalchemy.sql import func


from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, ForbiddenError
from app.repositories.chat_repo import session_repo, message_repo
from app.services import cloudinary_service
from app.models.document import Document
from app.models.chat_message import MessageRole
from app.models.chat_message import ChatMessage
from app.models.query_log import QueryLog
from app.schemas.chat import (
    ChatSessionCreate,
    ChatSessionUpdate,
    ChatSessionResponse,
    ChatMessageCreate,
    ChatMessageResponse,
    ChatSessionWithMessages,
)
from app.db.session import get_session_local


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

# AI response generation (Refactored from mock)
def create_assistant_response(
    db: Session,
    session_id: UUID,
    content: str = "OKE! Tôi đã xử lý xong yêu cầu của bạn."
) -> ChatMessageResponse:
    """Internal helper to create an assistant message in the database."""
    msg = message_repo.create(
        db,
        obj_in={
            "session_id": session_id,
            "role": MessageRole.assistant,
            "content": content,
        },
    )
    
    # Update session timestamp
    s = session_repo.get_by_id(db, session_id)
    if s:
        s.updated_at = func.now()
    
    db.commit()
    return ChatMessageResponse.model_validate(msg)

async def generate_assistant_response_task(
    session_id: UUID,
    user_query: str,
):
    """
    Background task to simulate RAG/LLM processing and save assistant response.
    Includes performance tracking for monitoring.
    """
    start_time = time.perf_counter()
    db = get_session_local()()
    
    assistant_msg = None
    is_error = False
    error_message = None
    chunk_found = False

    try:
        # Simulate processing time (5-8 seconds)
        await asyncio.sleep(random.uniform(5, 8))
        
        # Here we would normally call the RAG process
        # Logic to determine if "chunks were found" (simplified mock)
        chunk_found = "không tìm thấy" not in user_query.lower()

        # For now, we use a mock response logic
        content = f"OKE! Tôi đã nhận được yêu cầu: '{user_query[:50]}...'. Đây là phản hồi giả lập được xử lý ngầm (Background Task). Dù bạn có reload trang thì tôi vẫn sẽ trả lời!"
        
        # ── Create the assistant message ──
        assistant_msg = create_assistant_response(db, session_id, content)
        
    except Exception as e:
        is_error = True
        error_message = str(e)
        print(f"Error in background task: {e}")
    finally:
        end_time = time.perf_counter()
        response_time_ms = int((end_time - start_time) * 1000)

        # ── Log query metrics ──
        try:
            query_log = QueryLog(
                session_id=session_id,
                message_id=assistant_msg.id if assistant_msg else None,
                response_time_ms=response_time_ms,
                chunk_found=chunk_found,
                is_error=is_error,
                error_message=error_message
            )
            db.add(query_log)
            db.commit()
        except Exception as log_err:
            print(f"Failed to save query log: {log_err}")
            db.rollback()
        
        db.close()

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
