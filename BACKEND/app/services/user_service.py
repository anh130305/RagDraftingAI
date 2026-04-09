"""
services.user_service – User profile management.
"""

from typing import List
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.repositories.user_repo import user_repo
from app.models.user import User
from app.schemas.user import UserUpdate, AdminUserUpdate, UserResponse


def get_user(db: Session, user_id: UUID) -> UserResponse:
    user = user_repo.get_by_id(db, user_id)
    if not user:
        raise NotFoundError("User")
    return UserResponse.model_validate(user)


def update_profile(db: Session, user_id: UUID, payload: UserUpdate) -> UserResponse:
    user = user_repo.get_by_id(db, user_id)
    if not user:
        raise NotFoundError("User")
    updated = user_repo.update(db, db_obj=user, obj_in=payload.model_dump(exclude_unset=True))
    return UserResponse.model_validate(updated)


def list_users(db: Session, *, skip: int = 0, limit: int = 100) -> List[UserResponse]:
    users = user_repo.get_all(db, skip=skip, limit=limit)
    return [UserResponse.model_validate(u) for u in users]


def admin_update_user(
    db: Session, user_id: UUID, payload: AdminUserUpdate
) -> UserResponse:
    user = user_repo.get_by_id(db, user_id)
    if not user:
        raise NotFoundError("User")
    updated = user_repo.update(db, db_obj=user, obj_in=payload.model_dump(exclude_unset=True))
    return UserResponse.model_validate(updated)
