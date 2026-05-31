import sys
import zipfile
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn
from lxml import etree

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from docx_filler import DocxFiller  # noqa: E402


def test_noi_dung_dien_bien_uses_line_breaks_not_extra_paragraphs(tmp_path):
    docx_path = tmp_path / "draft.docx"
    doc = Document()
    doc.add_paragraph("Nội dung: {{NOI_DUNG_DIEN_BIEN}}")
    doc.save(docx_path)

    filler = DocxFiller(forms_dir=tmp_path, drafts_dir=tmp_path)
    filled, missing, unfilled = filler._fill_docx(
        docx_path,
        {
            "NOI_DUNG_DIEN_BIEN": (
                "1. Khai mạc cuộc họp.\\n\\n"
                "2. Thảo luận nội dung.\\n\\n"
                "3. Kết luận cuộc họp."
            )
        },
    )

    with zipfile.ZipFile(docx_path) as archive:
        document_xml = archive.read("word/document.xml").decode("utf-8")

    document_root = etree.fromstring(document_xml.encode("utf-8"))
    paragraphs = document_root.findall(".//" + qn("w:p"))
    breaks = document_root.findall(".//" + qn("w:br"))

    assert filled == ["NOI_DUNG_DIEN_BIEN"]
    assert missing == []
    assert unfilled == []
    assert len(paragraphs) == 1
    assert len(breaks) == 2
    assert "1. Khai mạc cuộc họp." in document_xml
    assert "2. Thảo luận nội dung." in document_xml
    assert "3. Kết luận cuộc họp." in document_xml
