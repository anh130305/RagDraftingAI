import uuid
from typing import Optional
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from fastapi import HTTPException, status

from app.models.user import User, UserRole
from app.core.config import settings
from app.core.security import create_access_token

def verify_google_token(token: str) -> dict:
    """Verify the Google ID Token and return the payload."""
    try:
        # Verify the ID token
        idinfo = id_token.verify_oauth2_token(
            token, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )

        # ID token is valid. Get the user's Google ID from the 'sub' claim.
        return idinfo
    except ValueError as e:
        # Invalid token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(e)}",
        )

def authenticate_google_user(db: Session, idinfo: dict, department: Optional[str] = None) -> User:
    """
    Authenticate or register a user via Google.
    Handles existing user linking by email or google_id.
    """
    google_id = idinfo.get("sub")
    email = idinfo.get("email")
    full_name = idinfo.get("name", "")
    picture = idinfo.get("picture", "")

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account must have an email address."
        )

    # Try to find user by google_id
    user = db.query(User).filter(User.google_id == google_id).first()
    if user:
        # Update user info if needed
        if not user.email:
            user.email = email
            db.commit()
        return user

    # Try to find user by email (linking)
    user = db.query(User).filter(User.email == email).first()
    if user:
        # Link Google account to existing user
        user.google_id = google_id
        db.commit()
        return user

    # Create new user
    # Generate a unique username from email
    base_username = email.split("@")[0].lower()
    # Replace dots/specials with underscores to match our validation rules
    import re
    username = re.sub(r"[^a-z0-9_-]", "_", base_username)
    
    # Ensure uniqueness
    original_username = username
    counter = 1
    while db.query(User).filter(User.username == username).first():
        suffix = f"_{counter}"
        username = original_username[:50 - len(suffix)] + suffix
        counter += 1

    user = User(
        username=username,
        email=email,
        google_id=google_id,
        department=department,
        # Google users don't have a local password by default
        password_hash=None, 
        role=UserRole.user,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return user
