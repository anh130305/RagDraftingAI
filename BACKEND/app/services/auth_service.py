"""
services.auth_service – Registration and login logic.
"""

from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password, create_access_token
from app.core.exceptions import BadRequestError, UnauthorizedError, ConflictError
from app.repositories.user_repo import user_repo
from app.schemas.user import UserCreate, UserLogin, Token, UserResponse


def register(db: Session, payload: UserCreate) -> UserResponse:
    """Create a new user account.  Raises ConflictError if username taken."""
    existing = user_repo.get_by_username(db, payload.username)
    if existing:
        raise ConflictError(f"Username '{payload.username}' is already taken")

    user = user_repo.create(
        db,
        obj_in={
            "username": payload.username,
            "password_hash": hash_password(payload.password),
            "department": payload.department,
        },
    )
    return UserResponse.model_validate(user)


def login(db: Session, payload: UserLogin) -> Token:
    """Authenticate and return a JWT.  Raises UnauthorizedError on failure."""
    user = user_repo.get_by_username(db, payload.username)
    if not user or not verify_password(payload.password, user.password_hash):
        raise UnauthorizedError("Incorrect username or password")
    if not user.is_active:
        raise UnauthorizedError("Account is deactivated")

    token = create_access_token(data={"sub": str(user.id)})
    return Token(access_token=token)
