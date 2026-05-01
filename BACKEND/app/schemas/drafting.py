from typing import Optional, List, Dict
from pydantic import BaseModel, Field
from app.schemas.document import DocumentResponse

class DraftRequest(BaseModel):
    query: str = Field(
        ...,
        description="Yêu cầu soạn thảo chính",
        json_schema_extra={"example": "Soạn công văn hướng dẫn Luật Lưu trữ"},
    )
    extras: Optional[str] = Field(
        None,
        description="Thông tin bổ sung / ràng buộc",
        json_schema_extra={"example": "Ngày ký: 05/01/2025\nNgười ký: Cục trưởng"},
    )
    session_id: Optional[str] = Field(None, description="ID của phiên chat để gắn tài liệu vào")

class DraftMeta(BaseModel):
    query: str
    extras: Optional[str] = None
    elapsed_s: float
    form_id: str
    form_type: str
    legal_sources: List[str]
    context_stats: Dict[str, int]

class DraftResponse(BaseModel):
    status: str
    mode: str
    fields: Dict[str, str]
    meta: DraftMeta
    document: Optional[DocumentResponse] = None
