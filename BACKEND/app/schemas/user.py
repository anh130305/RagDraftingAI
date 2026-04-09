"""
schemas.user – Pydantic DTOs for user-related requests and responses.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.user import UserRole


# ── Requests ─────────────────────────────────────────────────

class UserCreate(BaseModel):
    """POST /auth/register"""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    department: Optional[str] = None


class UserLogin(BaseModel):
    """POST /auth/login"""
    username: str
    password: str


class UserUpdate(BaseModel):
    """PUT /users/me  — editable fields by the user themselves."""
    department: Optional[str] = None


class AdminUserUpdate(BaseModel):
    """PUT /admin/users/{id}  — admin can change role & active status."""
    role: Optional[UserRole] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None


# ── Responses ────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: UUID
    username: str
    role: UserRole
    department: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    """Returned on successful login."""
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    """Decoded JWT payload (internal use)."""
    sub: str  # user id as string
