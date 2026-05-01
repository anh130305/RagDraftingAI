"""
routes.documents – Document upload, listing, detail, and chunk retrieval.
"""

import io
import csv
import json
import xml.etree.ElementTree as ET
from uuid import UUID
from typing import Optional
from urllib.parse import unquote, urlparse

from fastapi import APIRouter, Depends, UploadFile, File, Form, Query, Request, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
import logging

from app.api.deps import get_db, require_chat_user
from app.core.config import settings
from app.models.user import User
from app.schemas.document import (
    CloudinaryUploadCompleteRequest,
    CloudinaryUploadCompleteResponse,
    CloudinaryUploadSignatureRequest,
    CloudinaryUploadSignatureResponse,
    DocumentResponse,
    DocumentWithChunks,
    DocumentListResponse,
)
from app.services import document_service, audit_service
from app.models.audit_log import AuditAction
from app.services import cloudinary_service
import httpx as _httpx
from starlette.concurrency import run_in_threadpool
import requests
import pytesseract
import fitz
import docx
from PIL import Image

router = APIRouter(prefix="/documents", tags=["Documents"])

logger = logging.getLogger(__name__)


def _parse_optional_uuid(value: Optional[str]) -> Optional[UUID]:
    if not value or value == "general":
        return None
    try:
        return UUID(value)
    except Exception:
        return None


def _decode_text_bytes(contents: bytes) -> str:
    for encoding in ("utf-8", "utf-8-sig", "cp1258", "latin-1"):
        try:
            return contents.decode(encoding)
        except UnicodeDecodeError:
            continue
    return contents.decode("utf-8", errors="replace")


def _extract_xml_text(contents: bytes) -> str:
    root = ET.fromstring(_decode_text_bytes(contents))
    return " ".join(part.strip() for part in root.itertext() if part and part.strip())


def _extract_csv_text(contents: bytes) -> str:
    text = _decode_text_bytes(contents)
    reader = csv.reader(io.StringIO(text))
    rows: list[str] = []
    for row in reader:
        cleaned = [cell.strip() for cell in row if cell and cell.strip()]
        if cleaned:
            rows.append(" | ".join(cleaned))
    return "\n".join(rows).strip()


def _extract_text_from_bytes(contents: bytes, *, filename: str = "", content_type: str = "") -> str:
    """Extract text from file bytes. Supports text, CSV, XML, PDF (OCR fallback), DOCX, and images."""
    lowered_filename = (filename or "").lower()
    lowered_content_type = (content_type or "").lower()

    if (
        lowered_filename.endswith(".txt")
        or lowered_filename.endswith(".md")
        or lowered_filename.endswith(".csv")
        or lowered_filename.endswith(".tsv")
        or lowered_filename.endswith(".json")
        or lowered_filename.endswith(".xml")
        or lowered_content_type.startswith("text/")
        or "csv" in lowered_content_type
        or "json" in lowered_content_type
        or ("xml" in lowered_content_type and "wordprocessingml" not in lowered_content_type)
        or "markdown" in lowered_content_type
    ):
        if lowered_filename.endswith(".csv") or lowered_filename.endswith(".tsv") or "csv" in lowered_content_type:
            return _extract_csv_text(contents)
        if lowered_filename.endswith(".json") or "json" in lowered_content_type:
            parsed = json.loads(_decode_text_bytes(contents))
            return json.dumps(parsed, ensure_ascii=False, indent=2)
        if lowered_filename.endswith(".xml") or "xml" in lowered_content_type:
            return _extract_xml_text(contents)
        return _decode_text_bytes(contents).strip()

    if lowered_filename.endswith(".pdf") or lowered_content_type == "application/pdf":
        doc = fitz.open(stream=contents, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()
        
        avg_chars_per_page = len(text.strip()) / max(len(doc), 1)
        if avg_chars_per_page < 50:  # Scanned PDF threshold
            ocr_text = ""
            for page in doc:
                # Render page as high-res image for better OCR accuracy
                pix = page.get_pixmap(dpi=300)
                img = Image.open(io.BytesIO(pix.tobytes("png")))
                page_text = pytesseract.image_to_string(img, lang="vie+eng")
                ocr_text += page_text + "\n"
            doc.close()
            return ocr_text.strip() if ocr_text.strip() else text.strip()

        doc.close()
        return text.strip()

    if lowered_filename.endswith(".docx") or "wordprocessingml" in lowered_content_type:
        doc = docx.Document(io.BytesIO(contents))
        text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
        return text.strip()

    if lowered_filename.endswith(".doc") or "application/msword" in lowered_content_type:
        raise ValueError("Định dạng DOC cũ chưa được hỗ trợ trong môi trường hiện tại. Hãy chuyển sang DOCX/PDF hoặc cài bộ chuyển đổi ngoài.")

    image = Image.open(io.BytesIO(contents))
    text = pytesseract.image_to_string(image, lang="vie+eng")
    return text.strip()


def _extract_text_from_cloudinary_url(url: str, *, filename: str = "", content_type: str = "") -> str:
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    return _extract_text_from_bytes(
        response.content,
        filename=filename,
        content_type=content_type,
    )


def _validate_cloudinary_url(url: str) -> str:
    parsed = urlparse(url or "")
    if parsed.scheme.lower() != "https" or parsed.netloc.lower() != "res.cloudinary.com":
        raise HTTPException(status_code=400, detail="URL tệp không hợp lệ.")

    decoded_path = unquote(parsed.path or "")
    if not decoded_path:
        raise HTTPException(status_code=400, detail="URL tệp không hợp lệ.")

    configured_cloud = (settings.CLOUDINARY_CLOUD_NAME or "").strip()
    if configured_cloud and configured_cloud != "YOUR_CLOUD_NAME":
        cloud_segment = f"/{configured_cloud}/"
        if cloud_segment not in decoded_path:
            raise HTTPException(status_code=400, detail="URL tệp không thuộc cloud đã cấu hình.")

    return decoded_path


def _validate_asset_ownership(public_id: str, user_id: str, session_id: str) -> str:
    normalized_public_id = (public_id or "").strip().lstrip("/")
    if not normalized_public_id:
        raise HTTPException(status_code=400, detail="Thiếu public_id hợp lệ.")

    expected_prefix = f"RagDraftingAI/{user_id}/{session_id}/"
    if not normalized_public_id.startswith(expected_prefix):
        raise HTTPException(status_code=403, detail="Không có quyền truy cập tệp này.")

    return normalized_public_id


@router.post("/upload/presign", response_model=CloudinaryUploadSignatureResponse)
def presign_document_upload(
    payload: CloudinaryUploadSignatureRequest,
    current_user: User = Depends(require_chat_user),
):
    """Return a signed Cloudinary upload payload for direct browser uploads."""
    logger.info("presign upload requested user=%s file=%s session=%s",
                str(current_user.id), payload.file_name, payload.chat_session_id)
    signature_payload = cloudinary_service.build_signed_upload_payload(
        file_name=payload.file_name,
        content_type=payload.content_type,
        user_id=str(current_user.id),
        session_id=payload.chat_session_id or "general",
    )
    return CloudinaryUploadSignatureResponse(**signature_payload)


@router.post("/upload", response_model=DocumentResponse, status_code=201)
def upload_document(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    chat_session_id: Optional[str] = Form("general"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user),
):
    """Upload a document."""
    try:
        # Use cloudinary if configured
        cloudinary_res = cloudinary_service.upload_to_cloudinary(
            file,
            user_id=str(current_user.id),
            session_id=chat_session_id,
        )
        logger.info("upload_document: cloudinary upload result user=%s file=%s public_id=%s",
                    str(current_user.id), getattr(file, 'filename', None), cloudinary_res.get('public_id'))
        file_path = cloudinary_res.get("url")
        cloudinary_public_id = cloudinary_res.get("public_id")
        # Prefer the bytes reported by Cloudinary for accurate file_size; fall back to UploadFile.size if present
        file_size = cloudinary_res.get("bytes") or getattr(file, "size", None)
    except Exception as e:
        # Log failure to audit trail
        background_tasks.add_task(
            audit_service.log_action,
            user_id=current_user.id,
            action=AuditAction.storage_error,
            resource_type="storage",
            detail={"error": str(e), "filename": file.filename},
            ip_address=request.client.host if request.client else None
        )
        raise HTTPException(
            status_code=500,
            detail="Máy chủ gặp lỗi lưu trữ. Vui lòng thử lại sau hoặc liên hệ quản trị viên."
        )


    doc = document_service.upload_document(
        db,
        title=title or file.filename,
        file_path=file_path,
        file_type=file.content_type,
        file_size=file_size,
        uploaded_by=current_user.id,
        session_id=UUID(chat_session_id) if chat_session_id and chat_session_id != "general" else None,
        cloudinary_public_id=cloudinary_public_id,
    )
    logger.info("upload_document: created doc id=%s title=%s user=%s",
                str(doc.id), doc.title, str(current_user.id))
    
    background_tasks.add_task(
        audit_service.log_action,
        user_id=current_user.id,
        action=AuditAction.upload_document,
        resource_type="document",
        resource_id=doc.id,
        ip_address=request.client.host if request.client else None
    )
    
    return doc


@router.post("/upload/complete", response_model=CloudinaryUploadCompleteResponse, status_code=201)
async def complete_document_upload(
    request: Request,
    background_tasks: BackgroundTasks,
    payload: CloudinaryUploadCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user),
):
    """Persist metadata after a direct Cloudinary upload and run OCR from the Cloudinary URL."""

    try:
        session_scope = payload.chat_session_id or "general"
        normalized_public_id = _validate_asset_ownership(
            payload.cloudinary_public_id,
            str(current_user.id),
            session_scope,
        )
        logger.info("complete_document_upload: user=%s public_id=%s session=%s",
                    str(current_user.id), payload.cloudinary_public_id, payload.chat_session_id)
        decoded_path = _validate_cloudinary_url(payload.file_path)
        if normalized_public_id not in decoded_path:
            raise HTTPException(status_code=400, detail="URL tệp không khớp public_id.")

        doc = document_service.upload_document(
            db,
            title=payload.title or payload.file_path.split("/")[-1],
            file_path=payload.file_path,
            file_type=payload.file_type,
            file_size=payload.file_size,
            uploaded_by=current_user.id,
            session_id=_parse_optional_uuid(payload.chat_session_id),
            cloudinary_public_id=normalized_public_id,
        )

        extracted_text = None
        ocr_error = None
        try:
            # Download file asynchronously instead of blocking with requests.get()
            async with _httpx.AsyncClient(timeout=30.0) as dl_client:
                dl_resp = await dl_client.get(payload.file_path)
            dl_resp.raise_for_status()
            file_bytes = dl_resp.content

            # Offload CPU-bound OCR to threadpool
            extracted_text = await run_in_threadpool(
                lambda: _extract_text_from_bytes(
                    file_bytes,
                    filename=payload.title or payload.file_path.split("/")[-1],
                    content_type=payload.file_type or "",
                )
            )
        except Exception as ocr_exc:
            ocr_error = str(ocr_exc)

        logger.info("complete_document_upload: created doc id=%s user=%s ocr_len=%s ocr_err=%s",
                    str(doc.id), str(current_user.id), len(extracted_text or ""), str(ocr_error))

        background_tasks.add_task(
            audit_service.log_action,
            user_id=current_user.id,
            action=AuditAction.upload_document,
            resource_type="document",
            resource_id=doc.id,
            ip_address=request.client.host if request.client else None,
            detail={
                "cloudinary_public_id": normalized_public_id,
                "uploaded_via": "cloudinary_presign",
                "ocr_text_length": len(extracted_text or ""),
                "ocr_error": ocr_error,
            },
        )

        return CloudinaryUploadCompleteResponse(document=doc, extracted_text=extracted_text, ocr_error=ocr_error)
    except HTTPException:
        raise
    except Exception as e:
        background_tasks.add_task(
            audit_service.log_action,
            user_id=current_user.id,
            action=AuditAction.storage_error,
            resource_type="storage",
            detail={"error": str(e), "filename": payload.title or payload.file_path},
            ip_address=request.client.host if request.client else None,
        )
        raise HTTPException(
            status_code=500,
            detail="Máy chủ gặp lỗi lưu trữ. Vui lòng thử lại sau hoặc liên hệ quản trị viên.",
        )


@router.post("/extract-text")
def extract_text_from_file(
    file: UploadFile = File(...),
    current_user: User = Depends(require_chat_user),
):
    """Run extraction on uploaded file and return extracted text."""
    try:
        contents = file.file.read()
        text = _extract_text_from_bytes(
            contents,
            filename=file.filename or "",
            content_type=file.content_type or "",
        )
        return {"text": text}
    except Exception as e:
        return {"text": "", "error": str(e)}

@router.get("", response_model=DocumentListResponse)
def list_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    session_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user),
):
    return document_service.list_documents(
        db,
        user_id=current_user.id,
        session_id=session_id,
        skip=skip,
        limit=limit,
    )


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user),
):
    return document_service.get_document(db, document_id)


@router.get("/{document_id}/chunks", response_model=DocumentWithChunks)
def get_document_chunks(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user),
):
    return document_service.get_document_with_chunks(db, document_id)


@router.delete("/{document_id}", status_code=204)
def delete_document(
    request: Request,
    document_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_chat_user),
):
    document_service.delete_document(db, document_id)
    background_tasks.add_task(
        audit_service.log_action,
        user_id=current_user.id,
        action=AuditAction.delete_document,
        resource_type="document",
        resource_id=document_id,
        ip_address=request.client.host if request.client else None
    )
