import io
import pytest
from unittest.mock import patch, MagicMock

class TestExtractText:
    """POST /api/v1/documents/extract-text"""

    @patch("app.api.v1.routes.documents.fitz.open")
    def test_extract_pdf(self, mock_fitz_open, client, normal_auth):
        # Mocking fitz.open (PyMuPDF)
        mock_page = MagicMock()
        mock_page.get_text.return_value = "PDF Text "
        mock_doc = MagicMock()
        # Mock the document iterator to simulate 2 pages
        mock_doc.__iter__.return_value = [mock_page, mock_page]
        mock_fitz_open.return_value = mock_doc

        file_content = b"fake pdf data"
        resp = client.post(
            "/api/v1/documents/extract-text",
            headers=normal_auth,
            files={"file": ("test.pdf", io.BytesIO(file_content), "application/pdf")},
        )
        
        assert resp.status_code == 200
        assert resp.json()["text"] == "PDF Text PDF Text"

    @patch("app.api.v1.routes.documents.docx.Document")
    def test_extract_docx(self, mock_docx, client, normal_auth):
        # Mocking docx.Document (python-docx)
        mock_doc = MagicMock()
        mock_para1 = MagicMock()
        mock_para1.text = "Docx line 1"
        mock_para2 = MagicMock()
        mock_para2.text = "Docx line 2"
        mock_doc.paragraphs = [mock_para1, mock_para2]
        mock_docx.return_value = mock_doc

        file_content = b"fake docx data"
        resp = client.post(
            "/api/v1/documents/extract-text",
            headers=normal_auth,
            files={"file": ("test.docx", io.BytesIO(file_content), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        )
        
        assert resp.status_code == 200
        assert resp.json()["text"] == "Docx line 1\nDocx line 2"

    @patch("app.api.v1.routes.documents.Image.open")
    @patch("app.api.v1.routes.documents.pytesseract.image_to_string")
    def test_extract_image(self, mock_ocr, mock_image_open, client, normal_auth):
        # Mocking PIL.Image and pytesseract
        mock_ocr.return_value = "Image OCR Text"
        
        file_content = b"fake image data"
        resp = client.post(
            "/api/v1/documents/extract-text",
            headers=normal_auth,
            files={"file": ("test.jpg", io.BytesIO(file_content), "image/jpeg")},
        )
        
        assert resp.status_code == 200
        assert resp.json()["text"] == "Image OCR Text"

    def test_extract_exception_handling(self, client, normal_auth):
        # Test error handling flow by sending a corrupt pdf and NOT mocking
        # so it hits the exception block when trying to parse gibberish.
        file_content = b"this is not a valid pdf but claims to be"
        resp = client.post(
            "/api/v1/documents/extract-text",
            headers=normal_auth,
            files={"file": ("corrupt.pdf", io.BytesIO(file_content), "application/pdf")},
        )
        
        assert resp.status_code == 200
        assert "error" in resp.json()
        assert resp.json()["text"] == ""
