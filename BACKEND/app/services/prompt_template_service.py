"""
services.prompt_template_service – Business logic for prompt templates.
"""

from typing import List, Tuple, Optional
from uuid import UUID
import re

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.repositories.prompt_template_repo import prompt_template_repo
from app.schemas.prompt_template import (
    PromptTemplateCreate,
    PromptTemplateUpdate,
    PromptTemplateResponse,
    PromptTemplateListResponse,
)



def _split_prompt_smart(content: str) -> Tuple[str, Optional[str]]:
    """
    Hàm phân tách thông minh: Tách content thành (query, extra_instructions).
    Tìm khoảng trống (\n\n) đầu tiên mà sau đó là các dòng có dạng 'Nhãn: Giá trị'.
    """
    if not content:
        return "", None
    
    # Pattern: \n\n theo sau bởi 1 dòng có dấu hai chấm ':' (Label: Value)
    # Giới hạn nhãn từ 2-30 ký tự để tránh bắt nhầm câu văn bình thường có dấu hai chấm.
    pattern = r'\n{2,}(?=[ \t]*[^:\n]{2,30}:)'
    match = re.search(pattern, content)
    
    if match:
        split_pos = match.start()
        query = content[:split_pos].strip()
        extra = content[split_pos:].strip()
        return query, extra
    
    return content.strip(), None


def list_active_templates(db: Session) -> PromptTemplateListResponse:
    """List only active prompt templates (for users)."""
    items = prompt_template_repo.get_active(db)
    total = prompt_template_repo.count_active(db)
    return PromptTemplateListResponse(
        items=[PromptTemplateResponse.model_validate(t) for t in items],
        total=total,
    )


def list_all_templates(
    db: Session, skip: int = 0, limit: int = 100
) -> PromptTemplateListResponse:
    """List all prompt templates (for admins)."""
    items = prompt_template_repo.get_all(db, skip=skip, limit=limit)
    total = prompt_template_repo.count_all(db)
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
    query, extra = _split_prompt_smart(payload.content)
    
    tpl = prompt_template_repo.create(
        db,
        obj_in={
            "name": payload.name,
            "description": payload.description,
            "query": query,
            "extra_instructions": extra,
            "mode": payload.mode,
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
    
    # Nếu có cập nhật nội dung, thực hiện tách thông minh
    if "content" in update_data:
        content = update_data.pop("content")
        query, extra = _split_prompt_smart(content)
        update_data["query"] = query
        update_data["extra_instructions"] = extra

    tpl = prompt_template_repo.update(db, db_obj=tpl, obj_in=update_data)
    return PromptTemplateResponse.model_validate(tpl)


def delete_template(db: Session, template_id: UUID) -> None:
    """Hard delete a prompt template from the database."""
    tpl = prompt_template_repo.get_by_id(db, template_id)
    if not tpl:
        raise NotFoundError("Prompt template not found")
    prompt_template_repo.delete(db, id=template_id)

    return PromptTemplateResponse.model_validate(tpl)
