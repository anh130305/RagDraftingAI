"""
services.rag_service – Wrapper for the PromptAPI from the RAG module.
"""

import sys
import os
import logging
from pathlib import Path
from contextlib import contextmanager
from typing import Dict, Any, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

@contextmanager
def rag_working_directory(path: Path):
    """Context manager to temporarily change the working directory."""
    origin = Path.cwd()
    try:
        os.chdir(path)
        yield
    finally:
        os.chdir(origin)

class RAGService:
    def __init__(self):
        self._api = None
        # Root path of the RAG module relative to the backend execution context
        self.rag_path = Path(settings.RAG_ROOT_PATH).resolve()
        
    def initialize(self):
        """
        Initialize the PromptAPI once. 
        This is a heavy operation (20-40s) as it loads models.
        """
        if self._api is not None:
            return

        if not self.rag_path.exists():
            logger.error(f"RAG root path not found at {self.rag_path}")
            return

        # Add RAG directory to sys.path to allow imports
        if str(self.rag_path) not in sys.path:
            sys.path.append(str(self.rag_path))

        # Ensure API keys are in environment variables for PromptAPI to pick up
        if settings.GROQ_API_KEY:
            os.environ["GROQ_API_KEY"] = settings.GROQ_API_KEY
        if settings.OPENAI_API_KEY:
            os.environ["OPENAI_API_KEY"] = settings.OPENAI_API_KEY
        if settings.LLM_MODEL:
            os.environ["LLM_MODEL"] = settings.LLM_MODEL

        try:
            # Change directory to RAG root so hybrid_retrieval can find its dataset/models
            with rag_working_directory(self.rag_path):
                from promptApi import PromptAPI
                logger.info("Initializing PromptAPI (this may take 20-40s)...")
                # Không truyền tham số để sử dụng giá trị mặc định của module RAG
                self._api = PromptAPI()
                logger.info("PromptAPI initialized successfully.")
        except Exception as e:
            logger.exception(f"Failed to initialize PromptAPI: {e}")

    @property
    def api(self):
        if self._api is None:
            self.initialize()
        return self._api

    def answer_legal_question(self, query: str, extras: Optional[str] = None) -> Dict[str, Any]:
        """Call the RAG legal_qa mode."""
        if not self.api:
            return {
                "status": "error", 
                "mode": "legal_qa",
                "error": "RAG Service not initialized",
                "meta": {"query": query, "extras": extras}
            }
        
        with rag_working_directory(self.rag_path):
            return self.api.legal_qa(query=query, extras=extras)

    def draft_document(
        self, 
        query: str, 
        extras: Optional[str] = None, 
        legal_type_filter: Optional[str] = None
    ) -> Dict[str, Any]:
        """Call the RAG draft mode."""
        if not self.api:
            return {
                "status": "error", 
                "mode": "draft",
                "error": "RAG Service not initialized",
                "meta": {"query": query, "extras": extras}
            }
            
        with rag_working_directory(self.rag_path):
            return self.api.draft(
                query=query, 
                extras=extras, 
                legal_type_filter=legal_type_filter
            )

    def export_to_docx(self, form_id: str, fields: Dict[str, str], output_path: str) -> str:
        """
        Fill a Word template based on form_id and fields.
        Returns the path to the generated file.
        """
        # Mapping between Form_ID and the actual filenames in RAG/Forms/docx
        # Note: expecting .docx files as per python-docx requirements
        FORM_MAPPING = {
            "Form_01": "Mau_1.1_–_Nghi_quyet_(ca_biet)_1011143252_2605081617.docx",
            "Form_02": "Mau_1.2_–_Quyet_dinh_(ca_biet)_quy_dinh_truc_tiep_1011143252_2605081624.docx",
            "Form_03": "Mau_1.3_–_Quyet_dinh_(quy_dinh_gian_tiep)_1011143252_2605081844.docx",
            "Form_04": "Mau_1.4_–_Van_ban_co_ten_loai_1011143252_2605082055.docx",
            "Form_05": "Mau_1.5_–_Cong_van_1011143252_2605082306.docx",
            "Form_06": "Mau_1.6_–_Cong_dien_1011143252_2605082456.docx",
            "Form_07": "Mau_1.7_–_Giay_moi_1011143252_2605082531.docx",
            "Form_08": "Mau_1.8_–_Giay_gioi_thieu_1011143252_2605082604.docx",
            "Form_09": "Mau_1.9_–_Bien_ban_1011143252_2605082644.docx",
            "Form_10": "Mau_1.10_-_Giay_nghi_phep_1011143252_2605082746.docx",
        }

        template_filename = FORM_MAPPING.get(form_id)
        if not template_filename:
            raise ValueError(f"No template mapping found for {form_id}")

        template_path = self.rag_path / "Forms" / "docx" / template_filename
        
        # Check if .docx exists, if not check if .doc exists to provide better error
        if not template_path.exists():
            doc_fallback = template_path.with_suffix(".doc")
            if doc_fallback.exists():
                raise FileNotFoundError(
                    f"Template {template_filename} not found. "
                    f"Found {doc_fallback.name} but it must be converted to .docx first."
                )
            raise FileNotFoundError(f"Template path not found: {template_path}")

        try:
            with rag_working_directory(self.rag_path):
                from promptTemplates import fill_word_template
                # wrap fields into the structure expected by fill_word_template
                parsed_mock = {"fields": fields}
                fill_word_template(str(template_path), parsed_mock, output_path)
                return output_path
        except Exception as e:
            logger.exception(f"Error filling word template: {e}")
            raise

# Singleton instance
rag_service = RAGService()
