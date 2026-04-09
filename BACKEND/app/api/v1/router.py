"""
api.v1.router – Aggregate all v1 route modules into a single APIRouter.
"""

from fastapi import APIRouter

from app.api.v1.routes import auth, users, chat, documents, admin, internal

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(chat.router)
api_router.include_router(documents.router)
api_router.include_router(admin.router)
api_router.include_router(internal.router)
