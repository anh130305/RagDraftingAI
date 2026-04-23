"""
services.rag_service – Wrapper for the RAG Service (Standalone API).
"""

import asyncio
import sys
import json
import logging
from pathlib import Path
from typing import AsyncGenerator, Dict, Any, Optional
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


FORM_DOCX_MAPPING = {
    "Form_01": "Mau_1.1_–_Nghi_quyet__ca_biet__1011143252_2605081617.docx",
    "Form_02": "Mau_1.2_–_Quyet_dinh__ca_biet__quy_dinh_truc_tiep_1011143252_2605081624.docx",
    "Form_03": "Mau_1.3_–_Quyet_dinh_(quy_dinh_gian_tiep)_1011143252_2605081844.docx",
    "Form_04": "Mau_1.4_–_Van_ban_co_ten_loai_1011143252_2605082055.docx",
    "Form_05": "Mau_1.5_–_Cong_van_1011143252_2605082306.docx",
    "Form_06": "Mau_1.6_–_Cong_dien_1011143252_2605082456.docx",
    "Form_07": "Mau_1.7_–_Giay_moi_1011143252_2605082531.docx",
    "Form_08": "Mau_1.8_–_Giay_gioi_thieu_1011143252_2605082604.docx",
    "Form_09": "Mau_1.9_–_Bien_ban_1011143252_2605082644.docx",
    "Form_10": "Mau_1.10_-_Giay_nghi_phep_1011143252_2605082746.docx",
}


FORM_MD_MAPPING = {
    "Form_01": "Mau_1.1_NghiQuyetCaBiet.md",
    "Form_02": "Mau_1.2_QuyetDinhCaBiet.md",
    "Form_03": "Mau_1.3_QuyetDinh.md",
    "Form_04": "Mau_1.4_MauDaNang.md",
    "Form_05": "Mau_1.5_CongVan.md",
    "Form_06": "Mau_1.6_CongDien.md",
    "Form_07": "Mau_1.7_GiayMoi.md",
    "Form_08": "Mau_1.8_GiayGioiThieu.md",
    "Form_09": "Mau_1.9_BienBan.md",
    "Form_10": "Mau_1.10_GiayNghiPhep.md",
}

class RAGService:
    def __init__(self):
        self.base_url = f"{settings.RAG_SERVICE_URL.rstrip('/')}/api/v1/rag"
        # RAG_ROOT_PATH might still be needed for local template filling
        self.rag_path = Path(settings.RAG_ROOT_PATH).resolve()
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(120.0, connect=10.0, read=120.0),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
        )

    @staticmethod
    def _extract_error_detail(response: httpx.Response) -> str:
        """Best-effort parsing of downstream error payload for clearer client messages."""
        try:
            payload = response.json()
        except Exception:
            text = response.text.strip()
            return text or f"HTTP {response.status_code}"

        if isinstance(payload, dict):
            detail = payload.get("detail")
            if isinstance(detail, str):
                return detail
            if isinstance(detail, dict):
                nested = detail.get("error")
                if nested is not None:
                    return str(nested)
                return str(detail)

            if "error" in payload:
                return str(payload["error"])

        return str(payload)

    async def aclose(self) -> None:
        """Close the shared HTTP client gracefully on app shutdown."""
        await self._client.aclose()
        
    async def get_health(self) -> Dict[str, Any]:
        """Check if RAG service is ready."""
        try:
            response = await self._client.get(
                f"{self.base_url}/health",
                timeout=httpx.Timeout(5.0, connect=2.0, read=5.0),
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            return {
                "status": "error",
                "message": self._extract_error_detail(e.response),
                "http_status": e.response.status_code,
            }
        except httpx.HTTPError as e:
            return {"status": "error", "message": str(e)}

    async def answer_legal_question(self, query: str, extras: Optional[str] = None) -> Dict[str, Any]:
        """Call the RAG legal_qa mode via API."""
        try:
            response = await self._client.post(
                f"{self.base_url}/legal_qa",
                json={
                    "query": query,
                    "extras": extras,
                    "call_llm": True,
                },
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            detail = self._extract_error_detail(e.response)
            logger.error(
                "RAG API error (legal_qa) [%s]: %s",
                e.response.status_code,
                detail,
            )
            return {
                "status": "error",
                "mode": "legal_qa",
                "error": detail,
                "http_status": e.response.status_code,
                "meta": {"query": query, "extras": extras},
            }
        except httpx.HTTPError as e:
            logger.error("RAG API transport error (legal_qa): %s", e)
            return {
                "status": "error",
                "mode": "legal_qa",
                "error": str(e),
                "meta": {"query": query, "extras": extras}
            }

    async def stream_legal_question(
        self,
        query: str,
        extras: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream legal QA tokens via RAG NDJSON endpoint."""
        try:
            async with self._client.stream(
                "POST",
                f"{self.base_url}/legal_qa_stream",
                json={
                    "query": query,
                    "extras": extras,
                    "call_llm": True,
                },
            ) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    raw = (line or "").strip()
                    if not raw:
                        continue

                    try:
                        payload = json.loads(raw)
                    except json.JSONDecodeError:
                        logger.warning("Invalid NDJSON payload from RAG stream: %s", raw[:200])
                        continue

                    if isinstance(payload, dict):
                        yield payload
        except httpx.HTTPStatusError as e:
            detail = self._extract_error_detail(e.response)
            logger.error(
                "RAG API error (legal_qa_stream) [%s]: %s",
                e.response.status_code,
                detail,
            )
            yield {
                "type": "error",
                "error": detail,
                "http_status": e.response.status_code,
                "meta": {"query": query, "extras": extras},
            }
        except httpx.HTTPError as e:
            logger.error("RAG API transport error (legal_qa_stream): %s", e)
            yield {
                "type": "error",
                "error": str(e),
                "meta": {"query": query, "extras": extras},
            }
        except asyncio.CancelledError:
            logger.info("RAG stream cancelled by downstream client")
            raise

    async def draft_document(
        self, 
        query: str, 
        extras: Optional[str] = None, 
        legal_type_filter: Optional[str] = None
    ) -> Dict[str, Any]:
        """Call the RAG draft mode via API."""
        try:
            response = await self._client.post(
                f"{self.base_url}/draft",
                json={
                    "query": query,
                    "extras": extras,
                    "legal_type_filter": legal_type_filter,
                    "call_llm": True,
                },
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            detail = self._extract_error_detail(e.response)
            logger.error(
                "RAG API error (draft) [%s]: %s",
                e.response.status_code,
                detail,
            )
            return {
                "status": "error",
                "mode": "draft",
                "error": detail,
                "http_status": e.response.status_code,
                "meta": {"query": query, "extras": extras},
            }
        except httpx.HTTPError as e:
            logger.error("RAG API transport error (draft): %s", e)
            return {
                "status": "error",
                "mode": "draft",
                "error": str(e),
                "meta": {"query": query, "extras": extras}
            }

    def get_template_docx_path(self, form_id: str) -> Path:
        template_filename = FORM_DOCX_MAPPING.get(form_id)
        if not template_filename:
            raise ValueError(f"No template mapping found for {form_id}")
        return self.rag_path / "Forms" / "docx" / template_filename

    def get_template_markdown_path(self, form_id: str) -> Path:
        template_filename = FORM_MD_MAPPING.get(form_id)
        if not template_filename:
            raise ValueError(f"No markdown template mapping found for {form_id}")
        return self.rag_path / "Forms" / "md" / template_filename

    def export_to_docx(self, form_id: str, fields: Dict[str, str], output_path: str) -> str:
        """
        Fill a Word template based on form_id and fields.
        Note: This runs locally in the Backend as it requires access to local storage.
        """
        template_path = self.get_template_docx_path(form_id)
        
        if not template_path.exists():
            raise FileNotFoundError(f"Template path not found: {template_path}")

        try:
            # We still need promptTemplates.py locally for the generation logic
            # This logic doesn't require heavy AI models
            sys.path.append(str(self.rag_path))
            from promptTemplates import fill_word_template
            parsed_mock = {"fields": fields}
            fill_word_template(str(template_path), parsed_mock, output_path)
            return output_path
        except Exception as e:
            logger.exception(f"Error filling word template: {e}")
            raise

# Singleton instance
rag_service = RAGService()
