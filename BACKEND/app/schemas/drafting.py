from app.schemas.document import DocumentResponse

class DraftRequest(BaseModel):
    query: str = Field(..., description="Yêu cầu soạn thảo chính", example="Soạn công văn hướng dẫn Luật Lưu trữ")
    extras: Optional[str] = Field(None, description="Thông tin bổ sung / ràng buộc", example="Ngày ký: 05/01/2025\nNgười ký: Cục trưởng")
    legal_type_filter: Optional[str] = Field(None, description="Lọc loại văn bản: LUẬT | NGHỊ ĐỊNH | NGHỊ QUYẾT | PHÁP LỆNH")

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
