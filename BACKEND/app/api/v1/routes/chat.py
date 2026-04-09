"""
routes.chat – Session and message endpoints.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.chat import (
    ChatSessionCreate,
    ChatSessionUpdate,
    ChatSessionResponse,
    ChatMessageCreate,
    ChatMessageResponse,
    ChatSessionWithMessages,
)
from app.services import chat_service

router = APIRouter(prefix="/chat", tags=["Chat"])


# ── Sessions ─────────────────────────────────────────────────

@router.post("/sessions", response_model=ChatSessionResponse, status_code=201)
def create_session(
    payload: ChatSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return chat_service.create_session(db, current_user.id, payload)


@router.get("/sessions", response_model=List[ChatSessionResponse])
def list_sessions(
    include_archived: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return chat_service.list_sessions(
        db, current_user.id, include_archived=include_archived, skip=skip, limit=limit
    )


@router.get("/sessions/{session_id}", response_model=ChatSessionWithMessages)
def get_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return chat_service.get_session(db, session_id, current_user.id)


@router.put("/sessions/{session_id}", response_model=ChatSessionResponse)
def update_session(
    session_id: UUID,
    payload: ChatSessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return chat_service.update_session(db, session_id, current_user.id, payload)


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chat_service.delete_session(db, session_id, current_user.id)


# ── Messages ─────────────────────────────────────────────────

@router.get(
    "/sessions/{session_id}/messages", response_model=List[ChatMessageResponse]
)
def get_messages(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return chat_service.get_messages(db, session_id, current_user.id)


@router.post(
    "/sessions/{session_id}/messages",
    response_model=ChatMessageResponse,
    status_code=201,
)
def send_message(
    session_id: UUID,
    payload: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return chat_service.add_message(db, session_id, current_user.id, payload)
