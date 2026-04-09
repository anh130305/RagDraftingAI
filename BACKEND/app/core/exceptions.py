"""
core.exceptions – Reusable HTTP exceptions for the application.

Usage:
    raise NotFoundError("User")          → 404  "User not found"
    raise ForbiddenError()               → 403  "Forbidden"
    raise UnauthorizedError("Bad token") → 401  "Bad token"
"""

from fastapi import HTTPException, status


class NotFoundError(HTTPException):
    """404 – resource does not exist."""

    def __init__(self, resource: str = "Resource"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource} not found",
        )


class ForbiddenError(HTTPException):
    """403 – caller lacks permission."""

    def __init__(self, detail: str = "Forbidden"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


class UnauthorizedError(HTTPException):
    """401 – missing or invalid credentials."""

    def __init__(self, detail: str = "Could not validate credentials"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class BadRequestError(HTTPException):
    """400 – invalid input / business rule violation."""

    def __init__(self, detail: str = "Bad request"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        )


class ConflictError(HTTPException):
    """409 – duplicate entry or state conflict."""

    def __init__(self, detail: str = "Conflict"):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
        )
