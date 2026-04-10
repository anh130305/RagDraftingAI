"""
routes.users – GET/PUT /users/me
"""

from fastapi import APIRouter, Depends, Request, BackgroundTasks
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.user import UserUpdate, UserResponse
from app.services import user_service, audit_service
from app.models.audit_log import AuditAction

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
def get_my_profile(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
def update_my_profile(
    request: Request,
    payload: UserUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = user_service.update_profile(db, current_user.id, payload)
    background_tasks.add_task(
        audit_service.log_action,
        user_id=current_user.id,
        action=AuditAction.update_user,
        resource_type="user",
        resource_id=current_user.id,
        ip_address=request.client.host if request.client else None
    )
    return user
