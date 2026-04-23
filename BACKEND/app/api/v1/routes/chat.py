"""
routes.chat – Session and message endpoints.
"""

import asyncio
import json
import time
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_chat_user
from app.models.user import User
from app.schemas.chat import (
    ChatSessionCreate,
    ChatSessionUpdate,
    ChatSessionResponse,
    ChatMessageCreate,
    ChatMessageResponse,
    ChatSessionWithMessages,
    ChatMessageFeedbackUpdate,
)
from app.services import chat_service, audit_service, prompt_template_service
from app.models.audit_log import AuditAction
from app.models.query_log import QueryLog
from app.schemas.prompt_template import PromptTemplateListResponse

router = APIRouter(prefix="/chat", tags=["Chat"])


def _to_ndjson(payload: Dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, default=str) + "\n"


# ── Sessions ─────────────────────────────────────────────────

@router.post("/sessions", response_model=ChatSessionResponse, status_code=201)
def create_session(
    request: Request,
    payload: ChatSessionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user),
):
    session = chat_service.create_session(db, current_user.id, payload)
    background_tasks.add_task(
        audit_service.log_action,
        user_id=current_user.id,
        action=AuditAction.create_session,
        resource_type="chat_session",
        resource_id=session.id,
        ip_address=request.client.host if request.client else None
    )
    return session


@router.get("/sessions", response_model=List[ChatSessionResponse])
def list_sessions(
    include_archived: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user),
):
    return chat_service.list_sessions(
        db, current_user.id, include_archived=include_archived, skip=skip, limit=limit
    )


@router.get("/sessions/{session_id}", response_model=ChatSessionWithMessages)
def get_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user),
):
    return chat_service.get_session(db, session_id, current_user.id)


@router.put("/sessions/{session_id}", response_model=ChatSessionResponse)
def update_session(
    session_id: UUID,
    payload: ChatSessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user),
):
    return chat_service.update_session(db, session_id, current_user.id, payload)


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(
    request: Request,
    session_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user),
):
    chat_service.delete_session(db, session_id, current_user.id)
    background_tasks.add_task(
        audit_service.log_action,
        user_id=current_user.id,
        action=AuditAction.delete_session,
        resource_type="chat_session",
        resource_id=session_id,
        ip_address=request.client.host if request.client else None
    )


# ── Messages ─────────────────────────────────────────────────

@router.get(
    "/sessions/{session_id}/messages", response_model=List[ChatMessageResponse]
)
def get_messages(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user),
):
    return chat_service.get_messages(db, session_id, current_user.id)


@router.post(
    "/sessions/{session_id}/messages",
    response_model=ChatMessageResponse,
    status_code=201,
)
def send_message(
    request: Request,
    session_id: UUID,
    payload: ChatMessageCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user),
):
    msg = chat_service.add_message(db, session_id, current_user.id, payload)
    
    # Only QA mode needs an automatic assistant response in background.
    if payload.mode == "qa":
        background_tasks.add_task(
            chat_service.generate_assistant_response_task,
            session_id=session_id,
            user_query=payload.content,
            mode=payload.mode,
            extras=payload.extras,
        )

    # Log the query event
    background_tasks.add_task(
        audit_service.log_action,
        user_id=current_user.id,
        action=AuditAction.query,
        resource_type="chat_session",
        resource_id=session_id,
        ip_address=request.client.host if request.client else None,
        detail={"query_length": len(payload.content), "mode": payload.mode},
    )
    return msg


@router.post("/sessions/{session_id}/messages/stream")
async def stream_message(
    request: Request,
    session_id: UUID,
    payload: ChatMessageCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user),
):
    if payload.mode != "qa":
        raise HTTPException(
            status_code=400,
            detail="Streaming chỉ hỗ trợ mode 'qa'.",
        )

    user_msg = chat_service.add_message(db, session_id, current_user.id, payload)

    background_tasks.add_task(
        audit_service.log_action,
        user_id=current_user.id,
        action=AuditAction.query,
        resource_type="chat_session",
        resource_id=session_id,
        ip_address=request.client.host if request.client else None,
        detail={"query_length": len(payload.content), "mode": payload.mode, "stream": True},
    )

    async def event_generator():
        start_time = time.perf_counter()
        answer_parts: List[str] = []
        error_message: Optional[str] = None
        chunk_found = False
        stream_meta: Dict[str, Any] = {}
        assistant_msg: Optional[ChatMessageResponse] = None
        cancelled = False

        yield _to_ndjson({
            "type": "user_message",
            "message": user_msg.model_dump(mode="json"),
        })

        try:
            async for event in chat_service.stream_assistant_response(
                user_query=payload.content,
                extras=payload.extras,
            ):
                event_type = str(event.get("type", ""))

                if event_type == "meta":
                    meta_payload = event.get("meta")
                    if isinstance(meta_payload, dict):
                        stream_meta = meta_payload
                        chunk_found = bool(meta_payload.get("n_legal_chunks", 0))
                    yield _to_ndjson({"type": "meta", "meta": stream_meta})
                    continue

                if event_type == "token":
                    delta = event.get("delta")
                    if isinstance(delta, str) and delta:
                        answer_parts.append(delta)
                        yield _to_ndjson({"type": "token", "delta": delta})
                    continue

                if event_type == "done":
                    done_answer = event.get("answer")
                    if isinstance(done_answer, str) and done_answer and not answer_parts:
                        answer_parts.append(done_answer)

                    done_meta = event.get("meta")
                    if isinstance(done_meta, dict):
                        stream_meta = done_meta
                        chunk_found = bool(done_meta.get("n_legal_chunks", 0))
                    break

                if event_type == "error":
                    raw_error = event.get("error")
                    error_message = str(raw_error) if raw_error else "Lỗi streaming từ RAG service."
                    break
        except asyncio.CancelledError:
            cancelled = True
            raise
        except Exception as stream_err:
            error_message = str(stream_err)

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        assistant_text = "".join(answer_parts).strip()

        if error_message and not assistant_text:
            assistant_text = "Xin lỗi, đã có lỗi hệ thống xảy ra khi xử lý yêu cầu của bạn."

        try:
            if assistant_text:
                assistant_msg = chat_service.create_assistant_response(
                    db,
                    session_id,
                    assistant_text,
                    mode=payload.mode,
                )
                yield _to_ndjson({
                    "type": "assistant_message",
                    "message": assistant_msg.model_dump(mode="json"),
                })
                yield _to_ndjson({"type": "done", "meta": stream_meta})
            else:
                yield _to_ndjson({
                    "type": "error",
                    "error": error_message or "Không nhận được phản hồi từ mô hình.",
                    "meta": stream_meta,
                })
        finally:
            try:
                query_log = QueryLog(
                    session_id=session_id,
                    message_id=assistant_msg.id if assistant_msg else None,
                    response_time_ms=elapsed_ms,
                    chunk_found=chunk_found,
                    is_error=bool(error_message),
                    error_message=error_message,
                )
                db.add(query_log)
                db.commit()
            except Exception:
                db.rollback()

    return StreamingResponse(
        event_generator(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

#API Mock Test Reponse from RAG AI
@router.post(
    "/sessions/{session_id}/messages/mock",
    response_model=ChatMessageResponse,
    status_code=201,
)
def send_mock_assistant_message(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user),
):
    """
    Mock endpoint: used by Frontend to create a fake AI response after the simulated 10s wait.
    TODO: Remove this once actual LLM integration is in place.
    """
    return chat_service.add_mock_assistant_message(db, session_id, current_user.id)


@router.put(
    "/messages/{message_id}/feedback",
    response_model=ChatMessageResponse,
)
def update_message_feedback(
    message_id: UUID,
    payload: ChatMessageFeedbackUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user),
):
    """Update feedback (like/dislike) for an AI message."""
    return chat_service.update_message_feedback(db, message_id, current_user.id, payload.feedback)


# ── Prompt Templates (User-facing) ───────────────────────────

@router.get("/prompt-templates", response_model=PromptTemplateListResponse)
def list_user_prompt_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user),
):
    """List active prompt templates for chat users."""
    return prompt_template_service.list_active_templates(db)


@router.post("/prompt-templates/{template_id}/use", status_code=204)
def use_prompt_template(
    request: Request,
    template_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_chat_user),
):
    """Log when a user selects/uses a prompt template."""
    background_tasks.add_task(
        audit_service.log_action,
        user_id=current_user.id,
        action=AuditAction.use_template,
        resource_type="prompt_template",
        resource_id=template_id,
        ip_address=request.client.host if request.client else None
    )
