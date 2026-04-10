"""
schemas.prompt_template – Pydantic DTOs for prompt templates.
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field


# ── Create / Update ─────────────────────────────────────────

class PromptTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    content: str = Field(..., min_length=1)


class PromptTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    content: Optional[str] = Field(None, min_length=1)
    is_active: Optional[bool] = None


# ── Response ────────────────────────────────────────────────

class PromptTemplateResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    content: str
    is_default: bool
    is_active: bool
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Paginated list ──────────────────────────────────────────

class PromptTemplateListResponse(BaseModel):
    items: List[PromptTemplateResponse]
    total: int
