"""
services.prompt_template_service – Business logic for prompt templates.
"""

from typing import List
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.repositories.prompt_template_repo import prompt_template_repo
from app.schemas.prompt_template import (
    PromptTemplateCreate,
    PromptTemplateUpdate,
    PromptTemplateResponse,
    PromptTemplateListResponse,
)


def list_templates(db: Session) -> PromptTemplateListResponse:
    """List all active prompt templates."""
    items = prompt_template_repo.get_active(db)
    total = prompt_template_repo.count_active(db)
    return PromptTemplateListResponse(
        items=[PromptTemplateResponse.model_validate(t) for t in items],
        total=total,
    )


def get_template(db: Session, template_id: UUID) -> PromptTemplateResponse:
    """Get a single template by ID."""
    tpl = prompt_template_repo.get_by_id(db, template_id)
    if not tpl:
        raise NotFoundError("Prompt template not found")
    return PromptTemplateResponse.model_validate(tpl)


def create_template(
    db: Session, admin_id: UUID, payload: PromptTemplateCreate
) -> PromptTemplateResponse:
    """Create a new prompt template."""
    tpl = prompt_template_repo.create(
        db,
        obj_in={
            "name": payload.name,
            "description": payload.description,
            "content": payload.content,
            "created_by": admin_id,
        },
    )
    return PromptTemplateResponse.model_validate(tpl)


def update_template(
    db: Session, template_id: UUID, payload: PromptTemplateUpdate
) -> PromptTemplateResponse:
    """Update an existing prompt template."""
    tpl = prompt_template_repo.get_by_id(db, template_id)
    if not tpl:
        raise NotFoundError("Prompt template not found")

    update_data = payload.model_dump(exclude_unset=True)
    tpl = prompt_template_repo.update(db, db_obj=tpl, obj_in=update_data)
    return PromptTemplateResponse.model_validate(tpl)


def delete_template(db: Session, template_id: UUID) -> None:
    """Soft delete a prompt template by setting is_active=False."""
    tpl = prompt_template_repo.get_by_id(db, template_id)
    if not tpl:
        raise NotFoundError("Prompt template not found")
    prompt_template_repo.update(db, db_obj=tpl, obj_in={"is_active": False, "is_default": False})


def set_default_template(db: Session, template_id: UUID) -> PromptTemplateResponse:
    """Set a template as the default one for the RAG pipeline."""
    tpl = prompt_template_repo.get_by_id(db, template_id)
    if not tpl or not tpl.is_active:
        raise NotFoundError("Prompt template not found or inactive")
    tpl = prompt_template_repo.set_default(db, template_id)
    return PromptTemplateResponse.model_validate(tpl)


def get_default_template(db: Session) -> PromptTemplateResponse:
    """Get the currently active default template."""
    tpl = prompt_template_repo.get_default(db)
    if not tpl:
        raise NotFoundError("No default prompt template configured")
    return PromptTemplateResponse.model_validate(tpl)
