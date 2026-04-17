from pathlib import Path
import re
import tempfile
import zipfile

import pytest

import app.api.v1.routes.drafting as drafting_route
from app.services.rag_service import FORM_MD_MAPPING


PLACEHOLDER_PATTERN = re.compile(r"\{\{\s*([^}]+?)\s*\}\}")


def _extract_placeholders_from_markdown(path: Path):
    text = path.read_text(encoding="utf-8", errors="ignore")
    return sorted(set(PLACEHOLDER_PATTERN.findall(text)))


def _extract_placeholders_from_docx(path: Path):
    xml_parts = []
    with zipfile.ZipFile(path) as archive:
        for name in archive.namelist():
            if name.startswith("word/") and name.endswith(".xml"):
                xml_parts.append(archive.read(name).decode("utf-8", errors="ignore"))
    return sorted(set(PLACEHOLDER_PATTERN.findall("\n".join(xml_parts))))


def _normalize_field_key(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "", name).upper()


def test_generate_docx_persists_assistant_message(client, normal_auth, monkeypatch):
    session_resp = client.post(
        "/api/v1/chat/sessions",
        headers=normal_auth,
        json={"title": "Drafting test"},
    )
    assert session_resp.status_code == 201
    session_id = session_resp.json()["id"]

    async def fake_generate_draft(payload, background_tasks, current_user):
        return {
            "status": "ok",
            "mode": "draft",
            "fields": {"Trich_yeu": "Van ban thu nghiem"},
            "meta": {
                "query": payload.query,
                "extras": payload.extras,
                "elapsed_s": 0.2,
                "form_id": "Form_05",
                "form_type": "Cong van",
                "legal_sources": [],
                "context_stats": {"n_legal_chunks": 1},
            },
        }

    def fake_export_to_docx(form_id, fields, output_path):
        Path(output_path).write_text("draft-content", encoding="utf-8")
        return output_path

    def fake_upload_local_file_to_cloudinary(file_path, user_id, session_id, filename):
        return {
            "url": "https://example.com/draft.docx",
            "public_id": "drafts/test-public-id",
            "bytes": 1024,
        }

    captured = {}

    def fake_create_assistant_response(db, session_id, content, mode="qa"):
        captured["session_id"] = str(session_id)
        captured["mode"] = mode
        captured["content"] = content
        return None

    monkeypatch.setattr(drafting_route, "generate_draft", fake_generate_draft)
    monkeypatch.setattr(drafting_route.rag_service, "export_to_docx", fake_export_to_docx)
    monkeypatch.setattr(
        drafting_route,
        "upload_local_file_to_cloudinary",
        fake_upload_local_file_to_cloudinary,
    )
    monkeypatch.setattr(
        drafting_route.chat_service,
        "create_assistant_response",
        fake_create_assistant_response,
    )

    resp = client.post(
        "/api/v1/drafting/generate-docx",
        headers=normal_auth,
        json={
            "query": "Soan cong van thong bao",
            "session_id": session_id,
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["document"] is not None

    assert captured["session_id"] == session_id
    assert captured["mode"] == "generate"
    assert "Tệp đính kèm" in captured["content"]


def test_generate_docx_fills_form05_placeholders_completely(client, normal_auth, monkeypatch):
    docx_module = pytest.importorskip("docx")
    Document = docx_module.Document

    template_md = drafting_route.rag_service.rag_path / "Forms" / "md" / "Mau_1.5_CongVan.md"
    template_docx = (
        drafting_route.rag_service.rag_path
        / "Forms"
        / "docx"
        / "Mau_1.5_–_Cong_van_1011143252_2605082306.docx"
    )
    if not template_md.exists() or not template_docx.exists():
        pytest.skip("Form_05 template files are not available in test environment")

    session_resp = client.post(
        "/api/v1/chat/sessions",
        headers=normal_auth,
        json={"title": "Drafting fill test"},
    )
    assert session_resp.status_code == 201
    session_id = session_resp.json()["id"]

    md_text = template_md.read_text(encoding="utf-8")
    md_fields = sorted(set(re.findall(r"\{\{([^}]+)\}\}", md_text)))
    fields = {name: f"VAL_{idx}" for idx, name in enumerate(md_fields, start=1)}

    # Keys below intentionally follow the markdown naming with underscores.
    # The DOCX template uses legacy names without underscores for these fields.
    fields["CO_QUAN_CA_NHAN_NHAN_1"] = "DON_VI_NHAN_1"
    fields["CO_QUAN_CA_NHAN_NHAN_2"] = "DON_VI_NHAN_2"
    fields["NOI_DUNG_CONG_VAN"] = "NOI_DUNG_CONG_VAN_DAY_DU"

    async def fake_generate_draft(payload, background_tasks, current_user):
        return {
            "status": "ok",
            "mode": "draft",
            "fields": fields,
            "meta": {
                "query": payload.query,
                "extras": payload.extras,
                "elapsed_s": 0.2,
                "form_id": "Form_05",
                "form_type": "Cong van",
                "legal_sources": [],
                "context_stats": {"n_legal_chunks": 1},
            },
        }

    captured = {"leftovers": [], "text": ""}

    def _collect_docx_text(path: str) -> str:
        doc = Document(path)
        lines = []
        for p in doc.paragraphs:
            lines.append(p.text)
        for t in doc.tables:
            for row in t.rows:
                for cell in row.cells:
                    for p in cell.paragraphs:
                        lines.append(p.text)
        for section in doc.sections:
            for p in section.header.paragraphs:
                lines.append(p.text)
            for p in section.footer.paragraphs:
                lines.append(p.text)
        return "\n".join(lines)

    def fake_upload_local_file_to_cloudinary(file_path, user_id, session_id, filename):
        text = _collect_docx_text(file_path)
        leftovers = sorted(set(re.findall(r"\{\{\s*([^}]+?)\s*\}\}", text)))
        captured["text"] = text
        captured["leftovers"] = leftovers
        return {
            "url": "https://example.com/draft.docx",
            "public_id": "drafts/test-public-id",
            "bytes": 1024,
        }

    monkeypatch.setattr(drafting_route, "generate_draft", fake_generate_draft)
    monkeypatch.setattr(
        drafting_route,
        "upload_local_file_to_cloudinary",
        fake_upload_local_file_to_cloudinary,
    )

    resp = client.post(
        "/api/v1/drafting/generate-docx",
        headers=normal_auth,
        json={
            "query": "Soan cong van thong bao",
            "session_id": session_id,
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["document"] is not None

    assert captured["leftovers"] == []
    assert "DON_VI_NHAN_1" in captured["text"]
    assert "DON_VI_NHAN_2" in captured["text"]
    assert "NOI_DUNG_CONG_VAN_DAY_DU" in captured["text"]


@pytest.mark.parametrize("form_id", sorted(FORM_MD_MAPPING.keys()))
def test_debug_compare_fields_and_word_fill_all_forms(form_id):
    pytest.importorskip("docx")

    markdown_path = drafting_route.rag_service.get_template_markdown_path(form_id)
    docx_path = drafting_route.rag_service.get_template_docx_path(form_id)

    assert markdown_path.exists(), f"{form_id}: markdown template missing ({markdown_path})"
    assert docx_path.exists(), f"{form_id}: docx template missing ({docx_path})"

    expected_markdown_fields = _extract_placeholders_from_markdown(markdown_path)
    expected_docx_placeholders = _extract_placeholders_from_docx(docx_path)

    assert expected_markdown_fields, f"{form_id}: no placeholders found in markdown template"
    assert expected_docx_placeholders, f"{form_id}: no placeholders found in docx template"

    # Simulate fields returned by RAG in markdown naming convention.
    returned_fields_map = {
        key: f"VAL_{idx}" for idx, key in enumerate(expected_markdown_fields, start=1)
    }
    returned_norm = {_normalize_field_key(k) for k in returned_fields_map}

    missing_after_normalization = sorted(
        key
        for key in expected_docx_placeholders
        if _normalize_field_key(key) not in returned_norm
    )

    assert missing_after_normalization == [], (
        f"{form_id}: missing placeholders after key normalization: {missing_after_normalization}"
    )

    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
        output_path = Path(tmp.name)

    try:
        drafting_route.rag_service.export_to_docx(
            form_id=form_id,
            fields=returned_fields_map,
            output_path=str(output_path),
        )
        unresolved_after_fill = _extract_placeholders_from_docx(output_path)
        assert unresolved_after_fill == [], (
            f"{form_id}: unresolved placeholders after fill: {unresolved_after_fill}"
        )
    finally:
        if output_path.exists():
            output_path.unlink()
