"""
api.deps – Dependency injection for FastAPI routes.

Provides get_db (database session) and get_current_user (JWT auth).
"""

from uuid import UUID

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.db.session import get_session_local
from app.core.security import decode_access_token
from app.core.exceptions import UnauthorizedError, ForbiddenError
from app.models.user import User, UserRole
from app.repositories.user_repo import user_repo

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# ── Database session ─────────────────────────────────────────

def get_db():
    """Yield a SQLAlchemy session, auto-closed after the request."""
    db = get_session_local()()
    try:
        yield db
    finally:
        db.close()


# ── Current user (JWT) ───────────────────────────────────────

def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    """Decode JWT and return the authenticated User ORM object."""
    try:
        payload = decode_access_token(token)
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise UnauthorizedError()
        user_id = UUID(user_id_str)
    except (JWTError, ValueError):
        raise UnauthorizedError()

    user = user_repo.get_by_id(db, user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError()
    return user


# ── Role check ───────────────────────────────────────────────

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that ensures the caller is an admin."""
    if current_user.role != UserRole.admin:
        raise ForbiddenError("Admin privileges required")
    return current_user
