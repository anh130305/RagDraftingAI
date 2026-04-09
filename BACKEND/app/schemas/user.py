"""
schemas.user – Pydantic DTOs for user-related requests and responses.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models.user import UserRole

VALID_DEPARTMENTS = ["BackEnd", "FrontEnd", "AI Engineer", "FullStack", "DevOps"]

# ── Requests ─────────────────────────────────────────────────

class UserCreate(BaseModel):
    """POST /auth/register"""
    username: str = Field(
        ...,
        min_length=3,
        max_length=50,
        pattern=r'^[a-zA-Z0-9_-]+$',
        description="Only letters, numbers, underscores, and hyphens",
    )
    password: str = Field(..., min_length=6, max_length=72)
    department: Optional[str] = Field(None, max_length=100)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("department")
    @classmethod
    def validate_department(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_DEPARTMENTS:
            raise ValueError(f"Phòng ban phải là một trong: {', '.join(VALID_DEPARTMENTS)}")
        return v


class UserLogin(BaseModel):
    """POST /auth/login"""
    username: str = Field(..., max_length=255)
    password: str = Field(..., max_length=255)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, v: str) -> str:
        return v.strip().lower()


class UserUpdate(BaseModel):
    """PUT /users/me  — editable fields by the user themselves."""
    department: Optional[str] = None

    @field_validator("department")
    @classmethod
    def validate_department(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_DEPARTMENTS:
            raise ValueError(f"Phòng ban phải là một trong: {', '.join(VALID_DEPARTMENTS)}")
        return v


class AdminUserUpdate(BaseModel):
    """PUT /admin/users/{id}  — admin can change role & active status."""
    role: Optional[UserRole] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("department")
    @classmethod
    def validate_department(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_DEPARTMENTS:
            raise ValueError(f"Phòng ban phải là một trong: {', '.join(VALID_DEPARTMENTS)}")
        return v


# ── Responses ────────────────────────────────────────────────

class UserResponse(BaseModel):
    id: UUID
    username: str
    role: str
    department: str | None = None
    email: str | None = None
    google_id: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    """Returned on successful login."""
    access_token: str
    token_type: str = "bearer"
    needs_onboarding: bool = False


class GoogleLoginRequest(BaseModel):
    id_token: str
    department: str | None = None


class TokenPayload(BaseModel):
    """Decoded JWT payload (internal use)."""
    sub: str  # user id as string
