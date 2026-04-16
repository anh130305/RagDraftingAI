"""
schemas.chat – Pydantic DTOs for chat sessions and messages.
"""

from datetime import datetime
from typing import Optional, List, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.chat_message import MessageRole


# ── Session ──────────────────────────────────────────────────

class ChatSessionCreate(BaseModel):
    """POST /chat/sessions"""
    title: Optional[str] = None


class ChatSessionUpdate(BaseModel):
    """PUT /chat/sessions/{id}"""
    title: Optional[str] = None
    is_archived: Optional[bool] = None
    is_pinned: Optional[bool] = None


class ChatSessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: Optional[str] = None
    is_archived: bool
    is_pinned: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Message ──────────────────────────────────────────────────

class ChatMessageCreate(BaseModel):
    """POST /chat/sessions/{id}/messages"""
    content: str = Field(..., min_length=1)
    mode: Literal["qa", "generate"] = Field("qa")

class ChatMessageFeedbackUpdate(BaseModel):
    """PUT /chat/messages/{id}/feedback"""
    feedback: Optional[str] = Field(None, description="'like', 'dislike', or null")


class ChatMessageResponse(BaseModel):
    id: UUID
    session_id: UUID
    role: MessageRole
    content: str
    feedback: Optional[str] = None
    token_count: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Aggregated ───────────────────────────────────────────────

class ChatSessionWithMessages(ChatSessionResponse):
    """GET /chat/sessions/{id} — session detail with full message history."""
    messages: List[ChatMessageResponse] = []
