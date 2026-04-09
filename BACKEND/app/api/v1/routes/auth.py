"""
routes.auth – POST /auth/register, POST /auth/login
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.user import UserCreate, UserLogin, Token, UserResponse, GoogleLoginRequest
from app.services import auth_service, google_auth_service
from app.core.rate_limit import limiter
from app.core.security import create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    return auth_service.register(db, payload)


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login(request: Request, payload: UserLogin, db: Session = Depends(get_db)):
    return auth_service.login(db, payload)


@router.post("/google-login", response_model=Token)
def google_login(payload: GoogleLoginRequest, db: Session = Depends(get_db)):
    # Verify Google token
    idinfo = google_auth_service.verify_google_token(payload.id_token)
    
    # Authenticate / Register user
    user = google_auth_service.authenticate_google_user(
        db, idinfo, department=payload.department
    )
    
    # Create access token
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "needs_onboarding": user.department is None
    }
