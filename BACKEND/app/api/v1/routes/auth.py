"""
routes.auth – POST /auth/register, POST /auth/login
"""

from fastapi import APIRouter, Depends, Request, BackgroundTasks
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.user import UserCreate, UserLogin, Token, UserResponse, GoogleLoginRequest
from app.services import auth_service, google_auth_service, audit_service
from app.models.audit_log import AuditAction
from app.core.rate_limit import limiter
from app.core.security import create_access_token, decode_access_token
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    return auth_service.register(db, payload)


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login(request: Request, payload: UserLogin, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    token = auth_service.login(db, payload)
    token_data = decode_access_token(token.access_token)
    
    background_tasks.add_task(
        audit_service.log_action,
        user_id=token_data["sub"],
        action=AuditAction.login,
        ip_address=request.client.host if request.client else None
    )
    return token
@router.post("/google-login", response_model=Token)
def google_login(request: Request, payload: GoogleLoginRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Verify Google token
    idinfo = google_auth_service.verify_google_token(payload.id_token)
    
    # Authenticate / Register user
    user = google_auth_service.authenticate_google_user(
        db, idinfo, department=payload.department
    )
    
    # Create access token
    access_token = create_access_token(data={"sub": str(user.id)})
    
    background_tasks.add_task(
        audit_service.log_action,
        user_id=user.id,
        action=AuditAction.login,
        ip_address=request.client.host if request.client else None,
        detail={"method": "google"}
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "needs_onboarding": user.department is None
    }

@router.post("/logout", status_code=204)
def logout(
    request: Request, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Client deletes token locally. Server records the audit event.
    """
    background_tasks.add_task(
        audit_service.log_action,
        user_id=current_user.id,
        action=AuditAction.logout,
        ip_address=request.client.host if request.client else None
    )
    return None
