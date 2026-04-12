"""
routes.chat – Session and message endpoints.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, BackgroundTasks
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
from app.schemas.prompt_template import PromptTemplateListResponse

router = APIRouter(prefix="/chat", tags=["Chat"])


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
    
    # Trigger intentional AI response in background
    background_tasks.add_task(
        chat_service.generate_assistant_response_task,
        session_id=session_id,
        user_query=payload.content
    )

    # Log the query event
    background_tasks.add_task(
        audit_service.log_action,
        user_id=current_user.id,
        action=AuditAction.query,
        resource_type="chat_session",
        resource_id=session_id,
        ip_address=request.client.host if request.client else None,
        detail={"query_length": len(payload.content)}
    )
    return msg

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
