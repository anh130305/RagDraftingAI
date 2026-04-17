"""
promptTemplates.py
==================
Template prompt tối ưu cho hệ thống RAG soạn thảo Văn bản Hành chính Việt Nam.

Tuân thủ Nghị định 30/2020/NĐ-CP về Công tác văn thư.

LLM output: JSON object duy nhất với 1 key duy nhất:
    - "fields": dict {FIELD_NAME: value} — toàn bộ placeholder đã điền,
                BAO GỒM cả các field NOI_DUNG_* (thân văn bản tự do).

Usage:
    from promptTemplates import build_messages, parse_llm_json, fill_word_template
    messages = build_messages(query, retrieved)
    # ... gọi LLM API, lấy response text ...
    parsed = parse_llm_json(llm_response_text)
    fill_word_template("template/Form_05.docx", parsed, "output/van_ban.docx")
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Dict, List, Optional

# ============================================================
# 1. SYSTEM PROMPT
# ============================================================

SYSTEM_PROMPT = """Bạn là một Chuyên viên Hành chính Cao cấp tại Việt Nam, \
có chuyên môn sâu về soạn thảo và ban hành văn bản hành chính theo đúng quy định \
của Nghị định số 30/2020/NĐ-CP ngày 05/3/2020 của Chính phủ về Công tác văn thư.

## VAI TRÒ & PHẠM VI
- Bạn soạn thảo văn bản hành chính chuẩn mực cho các cơ quan Nhà nước Việt Nam.
- Bạn am hiểu thể thức, kỹ thuật trình bày văn bản theo Nghị định 30/2020/NĐ-CP \
(Phụ lục I, II, III) và các quy định pháp luật liên quan.
- Bạn nắm vững hệ thống văn bản quy phạm pháp luật Việt Nam: \
Hiến pháp > Luật/Bộ luật > Pháp lệnh > Nghị định > Nghị quyết > Thông tư.

## NGUYÊN TẮC SOẠN THẢO BẮT BUỘC
1. **Ưu tiên pháp lý**: Khi có sự chồng chéo giữa các văn bản pháp luật, \
luôn ưu tiên theo thứ bậc hiệu lực pháp lý: Luật > Pháp lệnh > Nghị định > Nghị quyết.
2. **Kiểm tra hiệu lực**: Trước khi trích dẫn bất kỳ văn bản pháp luật nào từ \
LEGAL_CONTEXT, bạn PHẢI tự đánh giá xem văn bản đó có còn hiệu lực tại thời điểm \
soạn thảo không (dựa trên ngày ban hành, thông tin hết hiệu lực nếu có). \
Nếu một văn bản đã hết hiệu lực hoặc bị thay thế bởi văn bản mới hơn trong \
LEGAL_CONTEXT, chỉ trích dẫn văn bản đang có hiệu lực.
3. **Điền đầy đủ**: Mỗi FIELD_NAME trong danh sách placeholder phải có giá trị. \
Nếu thiếu thông tin, điền giá trị mẫu hợp lý (ví dụ: "[Tên cơ quan]").
4. **Văn phong hành chính**: Ngôn ngữ trang trọng, chính xác, khách quan; \
câu ngắn gọn, rõ ràng; đúng thuật ngữ pháp lý.
5. **Trích dẫn pháp lý**: Viện dẫn căn cứ bằng đúng số hiệu và tên điều khoản \
từ LEGAL_CONTEXT. Ưu tiên văn bản có thứ bậc cao hơn khi chồng chéo. Chỉ trích dẫn nếu thực sự cần thiết và liên quan trực tiếp đến nội dung soạn thảo.\
Nếu LEGAL_CONTEXT không cung cấp điều khoản phù hợp, không nên thêm căn cứ pháp lý ngoài ý muốn.
6. **Tính nhất quán**: Số liệu, ngày tháng, chức danh, tên cơ quan phải nhất quán \
xuyên suốt toàn bộ văn bản.

## ĐỊNH DẠNG ĐẦU RA — BẮT BUỘC
- Trả về DUY NHẤT một JSON object hợp lệ, không kèm bất kỳ text nào khác.
- Không bọc trong code block markdown (``` ```).
- Không thêm lời giải thích, tiêu đề, hay chú thích trước/sau JSON.
- JSON có đúng 1 key ở cấp cao nhất:
    1. "fields": object chứa TẤT CẢ placeholder đã điền, BAO GỒM cả các field \
NOI_DUNG_* (thân văn bản tự do viết trực tiếp vào value của field tương ứng).
"""

SYSTEM_PROMPT_LEGAL_QA = """Bạn là một Chuyên gia Pháp luật Hành chính Việt Nam, \
có chuyên môn sâu về hệ thống pháp luật Việt Nam và khả năng giải thích, \
phân tích các quy định pháp luật một cách chính xác, dễ hiểu.

## VAI TRÒ & PHẠM VI
- Bạn trả lời các câu hỏi pháp luật liên quan đến hành chính Nhà nước Việt Nam.
- Bạn nắm vững thứ bậc hiệu lực pháp lý: \
Hiến pháp > Luật/Bộ luật > Pháp lệnh > Nghị định > Nghị quyết > Thông tư.
- Bạn phân tích và tổng hợp từ nhiều nguồn pháp luật, chỉ ra sự liên kết \
hoặc mâu thuẫn giữa các quy định khi cần thiết.

## NGUYÊN TẮC TRẢ LỜI BẮT BUỘC
1. **Căn cứ pháp lý rõ ràng**: Mỗi luận điểm phải được viện dẫn đúng \
số hiệu văn bản, điều khoản từ LEGAL_CONTEXT được cung cấp. Nếu LEGAL_CONTEXT không phù hợp thì\
tự trả lời theo kiến thức chung. Đặc biệt không nhắc đến cụm từ LEGAL_CONTEXT trong câu trả lời.
2. **Kiểm tra hiệu lực**: Trước khi trích dẫn, tự đánh giá văn bản còn \
hiệu lực không. Nếu có dấu hiệu hết hiệu lực → ghi chú "(cần xác minh hiệu lực)".
3. **Ưu tiên thứ bậc**: Khi có chồng chéo, ưu tiên văn bản có hiệu lực \
pháp lý cao hơn: Luật > Pháp lệnh > Nghị định > Nghị quyết.
4. **Trung thực về giới hạn**: Nếu LEGAL_CONTEXT không đủ để trả lời đầy đủ, \
nói rõ và gợi ý tra cứu thêm thay vì suy đoán.
5. **Văn phong pháp lý**: Chính xác, rõ ràng, không mơ hồ; \
thuật ngữ pháp lý đúng chuẩn.
6. **Tối ưu hóa phản hồi: Không đưa ra các nhận xét về tính phù hợp của dữ liệu đầu vào.\ 
Chỉ trình bày nội dung tư vấn/soạn thảo một cách trực tiếp.

## ĐỊNH DẠNG ĐẦU RA
- Trả lời bằng văn xuôi có cấu trúc rõ ràng (không cần JSON).
- Sử dụng tiêu đề, gạch đầu dòng nếu cần để trình bày nhiều điểm.
- Trích dẫn pháp luật theo dạng: "theo Điều X, [Tên văn bản] số [Số hiệu]..."
- Kết thúc bằng phần tóm tắt ngắn nếu câu trả lời dài.
"""


# ============================================================
# 2. PRIORITY LABELS
# ============================================================

_LEGAL_PRIORITY: Dict[str, int] = {
    "LUẬT"      : 1,
    "PHÁP LỆNH" : 2,
    "NGHỊ ĐỊNH" : 3,
    "NGHỊ QUYẾT": 4,
}

_PRIORITY_BADGE: Dict[str, str] = {
    "LUẬT"      : "⚖️ [LUẬT — Hiệu lực cao nhất]",
    "PHÁP LỆNH" : "📜 [PHÁP LỆNH]",
    "NGHỊ ĐỊNH" : "📋 [NGHỊ ĐỊNH]",
    "NGHỊ QUYẾT": "📌 [NGHỊ QUYẾT]",
}


def _priority_key(chunk: Dict) -> int:
    doc_type = chunk.get("metadata", {}).get("type_normalized", "")
    return _LEGAL_PRIORITY.get(doc_type, 99)


# ============================================================
# 3. CONTEXT FORMATTERS
# ============================================================

def _format_legal_context(legal_chunks: List[Dict]) -> str:
    if not legal_chunks:
        return "(Không tìm thấy điều khoản pháp luật liên quan.)"

    sorted_chunks = sorted(legal_chunks, key=_priority_key)
    parts: List[str] = []
    for idx, chunk in enumerate(sorted_chunks, start=1):
        meta     = chunk.get("metadata", {})
        doc_no   = meta.get("id", meta.get("source_doc_no", "N/A"))
        doc_type = meta.get("type_normalized", "N/A")
        doc_name = meta.get("doc_name", meta.get("name", "N/A"))
        article  = meta.get("article", "")
        text     = chunk.get("text", "").strip()
        badge    = _PRIORITY_BADGE.get(doc_type, f"[{doc_type}]")
        score    = chunk.get("rerank_score", 0.0)
        eff_date = meta.get("effective_date", "")
        exp_date = meta.get("expiry_date", "")

        validity_note = ""
        if exp_date:
            validity_note = f"\n    Hết hiệu lực: {exp_date} ⚠️ — KIỂM TRA trước khi trích dẫn"
        elif eff_date:
            validity_note = f"\n    Có hiệu lực từ: {eff_date}"

        header = (
            f"[{idx}] {badge}\n"
            f"    Số hiệu : {doc_no}\n"
            f"    Tên VB  : {doc_name}\n"
            f"    Điều    : {article}"
            f"{validity_note}\n"
            f"    Độ liên quan: {score:.3f}"
        )
        parts.append(f"{header}\n\n{text}")

    return "\n\n" + ("\n\n" + "─" * 60 + "\n\n").join(parts) + "\n"


def _format_form_template(form_chunks: List[Dict]) -> str:
    if not form_chunks:
        return "(Không tìm thấy biểu mẫu phù hợp.)"

    form      = form_chunks[0]
    meta      = form.get("metadata", {})
    form_id   = meta.get("form_id", "N/A")
    form_type = meta.get("form_type", "N/A")
    purpose   = meta.get("purpose", "N/A")
    text      = form.get("text", "").strip()

    placeholders = sorted(set(re.findall(r"\{\{([^}]+)\}\}", text)))
    noi_dung_phs = [p for p in placeholders if "NOI_DUNG" in p]
    other_phs    = [p for p in placeholders if "NOI_DUNG" not in p]

    all_fields_list = "\n    ".join(f"- {ph}" for ph in other_phs) if other_phs \
                      else "(không xác định)"
    noi_dung_list   = "\n    ".join(f"- {ph}" for ph in noi_dung_phs) if noi_dung_phs \
                      else "(không có)"

    header = (
        f"Form ID   : {form_id}\n"
        f"Loại VB   : {form_type}\n"
        f"Mục đích  : {purpose}\n"
        f'\nField metadata (điền vào "fields"):\n'
        f"    {all_fields_list}\n"
        f'\nField thân văn bản — CũNG điền vào "fields" (KHÔNG tạo key riêng):\n'
        f"    {noi_dung_list}"
    )
    return f"{header}\n\n{'─' * 60}\n\n{text}\n"


def _format_examples_context(example_chunks: List[Dict]) -> str:
    if not example_chunks:
        return "(Không tìm thấy ví dụ tương tự.)"

    parts: List[str] = []
    for idx, chunk in enumerate(example_chunks, start=1):
        meta     = chunk.get("metadata", {})
        scenario = meta.get("scenario", "N/A")
        text     = chunk.get("text", "").strip()
        parts.append(
            f"[Ví dụ {idx}]\n"
            f"Tình huống: {scenario}\n\n"
            f"{text}"
        )
    return "\n\n" + ("\n\n" + "─" * 60 + "\n\n").join(parts) + "\n"


def format_context(retrieved: Dict[str, List[Dict]]) -> Dict[str, str]:
    """
    Chuyển đổi kết quả retrieve_all() thành các khối văn bản cho prompt.

    Args:
        retrieved: Dict từ retrieve_all() với keys "legal", "form", "examples"

    Returns:
        Dict với keys: "legal_context", "form_template", "few_shot_examples"
    """
    return {
        "legal_context"     : _format_legal_context(retrieved.get("legal", [])),
        "form_template"     : _format_form_template(retrieved.get("form", [])),
        "few_shot_examples" : _format_examples_context(retrieved.get("examples", [])),
    }


# ============================================================
# 4. USER PROMPT BUILDER
# ============================================================

_NOI_DUNG_STRUCTURE_HINT: Dict[str, str] = {
    "cong van": (
        "Cấu trúc:\n"
        "  1. Căn cứ pháp lý (nếu có): trích đúng số hiệu từ LEGAL_CONTEXT — "
        "chỉ trích dẫn văn bản còn hiệu lực.\n"
        "  2. Lý do / mục đích gửi văn bản.\n"
        "  3. Nội dung đề nghị / thông báo / báo cáo cụ thể (số liệu, thời gian, địa điểm...).\n"
        "  4. Đề nghị cơ quan nhận phối hợp / xem xét / giải quyết.\n"
        "  Kết thúc bằng: '[Tên CQ] trân trọng./.' hoặc tương đương."
    ),
    "quyet dinh": (
        "Cấu trúc:\n"
        "  Điều 1: Nội dung quyết định chính (bổ nhiệm / phê duyệt / ban hành...).\n"
        "  Điều 2: Trách nhiệm thi hành (cơ quan, cá nhân liên quan).\n"
        "  Điều 3: Hiệu lực thi hành (ngày có hiệu lực).\n"
        "  Mỗi điều khoản viết thành một đoạn riêng, bắt đầu bằng **Điều N.**"
    ),
    "to trinh": (
        "Cấu trúc:\n"
        "  1. Căn cứ pháp lý (còn hiệu lực) và thực tiễn.\n"
        "  2. Sự cần thiết / lý do trình.\n"
        "  3. Nội dung đề xuất (phương án, chỉ tiêu, nguồn lực, tiến độ...).\n"
        "  4. Kiến nghị phê duyệt.\n"
        "  Kết thúc: '[Tên CQ] kính trình [Cấp trên] xem xét, phê duyệt./.' "
    ),
    "bien ban": (
        "Cấu trúc:\n"
        "  1. Thành phần tham dự (chủ trì, thư ký, đại biểu).\n"
        "  2. Nội dung diễn biến / ý kiến các bên.\n"
        "  3. Kết luận / thống nhất / cam kết.\n"
        "  4. Chữ ký các bên (nếu cần).\n"
        "  Ghi theo thứ tự thời gian, khách quan, trung thực."
    ),
    "giay nghi phep": (
        "Cấu trúc:\n"
        "  Nêu rõ: họ tên người nghỉ, chức vụ, thời gian nghỉ (từ ngày... đến ngày...), "
        "nơi nghỉ phép, chế độ nghỉ được hưởng.\n"
        "  Văn phong ngắn gọn, đủ ý, không cần căn cứ pháp lý dài."
    ),
}

_FORM_TYPE_HINT_MAP: Dict[str, str] = {
    "công văn"       : "cong van",
    "quyết định"     : "quyet dinh",
    "tờ trình"       : "to trinh",
    "biên bản"       : "bien ban",
    "giấy nghỉ phép" : "giay nghi phep",
}


def _get_noi_dung_hint(form_type: str) -> str:
    key = _FORM_TYPE_HINT_MAP.get(form_type.strip().lower(), "")
    return _NOI_DUNG_STRUCTURE_HINT.get(key, (
        "Viết đầy đủ văn phong hành chính: căn cứ pháp lý còn hiệu lực (nếu có) → "
        "nội dung chính → cam kết/điều khoản thi hành (nếu có). "
        "Chỉ trích dẫn văn bản pháp lý đã xác nhận còn hiệu lực từ LEGAL_CONTEXT."
    ))


def _extract_form_type_from_template(form_tmpl: str) -> str:
    m = re.search(r"Loại VB\s*:\s*(.+)", form_tmpl)
    return m.group(1).strip() if m else ""


def build_user_prompt(
    query: str,
    context: Dict[str, str],
    extra_instructions: Optional[str] = None,
) -> str:
    """
    Xây dựng user prompt yêu cầu LLM trả về JSON thuần túy với DUY NHẤT key "fields".

    Args:
        query              : Yêu cầu soạn thảo của người dùng
        context            : Dict từ format_context()
        extra_instructions : Hướng dẫn bổ sung (ngày ký, người ký, số VB...)

    Returns:
        Chuỗi prompt hoàn chỉnh
    """
    legal_ctx = context["legal_context"]
    form_tmpl = context["form_template"]
    few_shot  = context["few_shot_examples"]

    extra_block = ""
    if extra_instructions:
        extra_block = (
            "\n## YÊU CẦU BỔ SUNG\n"
            + extra_instructions.strip()
            + "\n"
        )

    # ── Tất cả placeholder (bao gồm cả NOI_DUNG_*) ──────────────
    all_placeholders = sorted(set(re.findall(r"\{\{([^}]+)\}\}", form_tmpl)))
    noi_dung_fields  = [p for p in all_placeholders if "NOI_DUNG" in p]
    other_fields     = [p for p in all_placeholders if "NOI_DUNG" not in p]

    # ── Schema ví dụ cho "fields" (tất cả field) ─────────────────
    all_field_lines = [f'    "{p}": "..."' for p in other_fields]
    for p in noi_dung_fields:
        form_type  = _extract_form_type_from_template(form_tmpl)
        hint_short = "(nội dung thân văn bản — xem hướng dẫn cấu trúc quy tắc 2)"
        all_field_lines.append(f'    "{p}": "{hint_short}"')
    fields_example = ",\n".join(all_field_lines) if all_field_lines \
                     else '    "(không có field)"'

    # ── Hướng dẫn cấu trúc NOI_DUNG_* ───────────────────────────
    form_type     = _extract_form_type_from_template(form_tmpl)
    noi_dung_hint = _get_noi_dung_hint(form_type)

    if noi_dung_fields:
        noi_dung_rule = (
            "2. CÁC FIELD THÂN VĂN BẢN — điền trực tiếp vào key \"fields\":\n"
            + "".join(f"   • {p}\n" for p in noi_dung_fields)
            + "   Viết nội dung theo cấu trúc sau:\n"
            + "   " + noi_dung_hint.replace("\n", "\n   ")
            + "\n   KHÔNG tạo key riêng ngoài \"fields\" cho các field này."
        )
    else:
        noi_dung_rule = (
            "2. Form này không có field NOI_DUNG_* — điền toàn bộ thông tin vào \"fields\"."
        )

    prompt = (
        "## YÊU CẦU SOẠN THẢO\n"
        + query.strip()
        + "\n"
        + extra_block
        + "\n"
        + "=" * 64 + "\n"
        + "## LEGAL_CONTEXT — Điều khoản pháp luật liên quan\n"
        + "(Thứ bậc hiệu lực: Luật > Pháp lệnh > Nghị định > Nghị quyết)\n"
        + "⚠️ BƯỚC BẮT BUỘC TRƯỚC KHI SOẠN THẢO: Với mỗi văn bản trong danh sách dưới đây,\n"
        + "hãy tự đánh giá hiệu lực pháp lý (còn hiệu lực / hết hiệu lực / không rõ).\n"
        + "Chỉ trích dẫn những văn bản được đánh giá là CÒN HIỆU LỰC.\n"
        + "Nếu không xác định được, ghi chú '(cần xác minh hiệu lực)' khi trích dẫn.\n"
        + legal_ctx
        + "\n"
        + "=" * 64 + "\n"
        + "## FORM_TEMPLATE — Biểu mẫu và danh sách FIELD_NAME\n"
        + form_tmpl
        + "\n"
        + "=" * 64 + "\n"
        + "## FEW_SHOT_EXAMPLES — Ví dụ tham khảo văn phong và cách điền\n"
        + few_shot
        + "\n"
        + "=" * 64 + "\n"
        + "## YÊU CẦU JSON ĐẦU RA\n\n"
        + "Phân tích yêu cầu và trả về JSON theo schema sau.\n"
        + "KHÔNG thêm bất kỳ text nào ngoài JSON:\n\n"
        + "{\n"
        + '  "fields": {\n'
        + fields_example + "\n"
        + "  }\n"
        + "}\n\n"
        + "Quy tắc bắt buộc:\n"
        + '1. "fields" phải chứa TẤT CẢ field đã liệt kê ở FORM_TEMPLATE, bao gồm\n'
        + '   cả field NOI_DUNG_*. KHÔNG tạo key nào khác ngoài "fields".\n'
        + noi_dung_rule + "\n"
        + '3. Mỗi value trong "fields" là string đơn — không lồng object/array.\n'
        + '4. Không để value là null — dùng chuỗi rỗng "" nếu không có thông tin.\n'
        + "5. Trích dẫn pháp lý trong NOI_DUNG_* chỉ được dùng văn bản CÒN HIỆU LỰC\n"
        + "   từ LEGAL_CONTEXT. Ưu tiên: Luật > Pháp lệnh > Nghị định > Nghị quyết.\n"
        + "6. JSON phải hợp lệ (RFC 8259): dấu phẩy và ngoặc kép đúng chuẩn.\n\n"
        + "Trước khi trả JSON, hãy tự kiểm tra:\n"
        + "- Đã đánh giá hiệu lực từng văn bản pháp luật trong LEGAL_CONTEXT chưa?\n"
        + "- Có đủ tất cả field (kể cả NOI_DUNG_*) trong \"fields\" chưa?\n"
        + "- Có key nào khác ngoài \"fields\" không? (Nếu có → xóa đi)\n"
        + "- JSON có hợp lệ không?\n"
        + "\n"
        + "Nếu chưa đúng → sửa lại trước khi trả về.\n"
        + "Trả về JSON ngay bây giờ:"
    )

    return prompt



def build_legal_qa_user_prompt(
    query: str,
    legal_context: str,
    extra_instructions: Optional[str] = None,
) -> str:
    """
    Xây dựng user prompt cho chế độ hỏi luật (không cần form/example).

    Args:
        query             : Câu hỏi pháp luật của người dùng
        legal_context     : Chuỗi đã format từ _format_legal_context()
        extra_instructions: Hướng dẫn bổ sung tuỳ chọn

    Returns:
        Chuỗi prompt hoàn chỉnh
    """
    extra_block = ""
    if extra_instructions:
        extra_block = (
            "\n## YÊU CẦU BỔ SUNG\n"
            + extra_instructions.strip()
            + "\n"
        )

    prompt = (
        "## CÂU HỎI PHÁP LUẬT\n"
        + query.strip()
        + "\n"
        + extra_block
        + "\n"
        + "=" * 64 + "\n"
        + "## LEGAL_CONTEXT — Điều khoản pháp luật liên quan\n"
        + "(Thứ bậc hiệu lực: Luật > Pháp lệnh > Nghị định > Nghị quyết)\n"
        + "⚠️ BƯỚC BẮT BUỘC TRƯỚC KHI TRẢ LỜI: Với mỗi văn bản dưới đây,\n"
        + "hãy tự đánh giá hiệu lực pháp lý (còn hiệu lực / hết hiệu lực / không rõ).\n"
        + "Chỉ viện dẫn những văn bản được đánh giá là CÒN HIỆU LỰC.\n"
        + legal_context
        + "\n"
        + "=" * 64 + "\n"
        + "## YÊU CẦU TRẢ LỜI\n\n"
        + "Dựa trên LEGAL_CONTEXT được cung cấp, hãy trả lời câu hỏi pháp luật trên.\n"
        + "Yêu cầu:\n"
        + "1. Viện dẫn đúng điều khoản, số hiệu văn bản từ LEGAL_CONTEXT.\n"
        + "2. Ưu tiên văn bản có hiệu lực pháp lý cao hơn khi có chồng chéo.\n"
        + "3. Nếu LEGAL_CONTEXT chưa đủ để trả lời hoàn chỉnh, nêu rõ và gợi ý tra cứu thêm.\n"
        + "4. Trình bày rõ ràng, có cấu trúc; dùng tiêu đề nếu câu trả lời có nhiều phần.\n\n"
        + "Trả lời:"
    )
    return prompt


# ============================================================
# 5. MESSAGES BUILDER
# ============================================================

def build_messages(
    query: str,
    retrieved: Dict[str, List[Dict]],
    extra_instructions: Optional[str] = None,
) -> List[Dict[str, str]]:
    """
    Xây dựng danh sách messages cho API (OpenAI / Anthropic chat format).

    Args:
        query              : Yêu cầu soạn thảo (tiếng Việt)
        retrieved          : Dict từ retrieve_all()
        extra_instructions : Hướng dẫn bổ sung (ngày ký, người ký, số VB...)

    Returns:
        [{"role": "system", "content": ...}, {"role": "user", "content": ...}]
    """
    ctx         = format_context(retrieved)
    user_prompt = build_user_prompt(query, ctx, extra_instructions)
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",   "content": user_prompt},
    ]


def build_legal_qa_messages(
    query: str,
    retrieved_legal: List[Dict],
    extra_instructions: Optional[str] = None,
) -> List[Dict[str, str]]:
    """
    Xây dựng messages cho chế độ HỎI LUẬT (không cần form/example).

    Args:
        query            : Câu hỏi pháp luật (tiếng Việt)
        retrieved_legal  : List[Dict] từ retrieve_legal() với top_k=5
        extra_instructions: Hướng dẫn bổ sung tuỳ chọn

    Returns:
        [{"role": "system", "content": ...}, {"role": "user", "content": ...}]
    """
    legal_ctx   = _format_legal_context(retrieved_legal)
    user_prompt = build_legal_qa_user_prompt(query, legal_ctx, extra_instructions)
    return [
        {"role": "system", "content": SYSTEM_PROMPT_LEGAL_QA},
        {"role": "user",   "content": user_prompt},
    ]



def parse_llm_json(raw: str) -> Dict:
    """
    Parse JSON từ LLM response. Xử lý các trường hợp LLM bọc code fence
    hoặc thêm text thừa trước/sau JSON.

    Args:
        raw: Toàn bộ string trả về từ LLM

    Returns:
        Dict đã chuẩn hóa với key duy nhất "fields" (dict chứa tất cả placeholder)

    Raises:
        ValueError nếu không tìm được JSON hợp lệ
    """
    text = raw.strip()

    # Bỏ code fence nếu LLM vẫn thêm vào dù đã dặn
    text = re.sub(r"^```(?:json)?\s*\n?", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n?\s*```\s*$",       "", text, flags=re.MULTILINE)
    text = text.strip()

    # Thử parse trực tiếp (happy path)
    try:
        return _validate_structure(json.loads(text))
    except json.JSONDecodeError:
        pass

    # Fallback: trích JSON object đầu tiên trong text
    match = re.search(r"\{[\s\S]+\}", text)
    if match:
        try:
            return _validate_structure(json.loads(match.group(0)))
        except json.JSONDecodeError:
            pass

    raise ValueError(
        "Không parse được JSON từ LLM output.\n"
        f"200 ký tự đầu: {raw[:200]!r}"
    )


def _validate_structure(data: Dict) -> Dict:
    """
    Chuẩn hóa và validate cấu trúc JSON từ LLM.
    Đảm bảo chỉ có key "fields" chứa toàn bộ placeholder (kể cả NOI_DUNG_*).

    Nếu LLM vẫn trả về key "noi_dung" riêng (trái với hướng dẫn), tự động
    gộp nó vào field NOI_DUNG tương ứng trong "fields" hoặc tạo key dự phòng.
    """
    if not isinstance(data, dict):
        raise ValueError(f"JSON root phải là object, nhận: {type(data).__name__}")

    # --- Recover nếu LLM trả flat dict (bỏ lớp "fields") ---
    if "fields" not in data:
        noi_dung_val = data.pop("noi_dung", "")
        data = {"fields": data, "_orphan_noi_dung": noi_dung_val}

    if not isinstance(data["fields"], dict):
        data["fields"] = {}

    # --- Gộp key "noi_dung" lạc vào "fields" nếu LLM vẫn tạo ---
    orphan = data.pop("_orphan_noi_dung", None) or data.pop("noi_dung", None)
    if orphan:
        # Tìm field NOI_DUNG_* trong fields để gộp vào, ưu tiên field đầu tiên
        noi_dung_keys = sorted(
            k for k in data["fields"] if "NOI_DUNG" in k.upper()
        )
        if noi_dung_keys:
            # Gộp: nếu field đã có nội dung thì bổ sung; nếu trống thì thay
            first_key = noi_dung_keys[0]
            if not data["fields"].get(first_key):
                data["fields"][first_key] = str(orphan)
            else:
                data["fields"][first_key] = (
                    data["fields"][first_key] + "\n\n" + str(orphan)
                ).strip()
        else:
            # Không tìm thấy field NOI_DUNG_* → tạo fallback key
            data["fields"]["NOI_DUNG"] = str(orphan)

    # Xóa các key ngoài "fields" nếu LLM vô tình thêm
    keys_to_remove = [k for k in data if k != "fields"]
    for k in keys_to_remove:
        data.pop(k, None)

    # --- Ép value về string, loại None ---
    data["fields"] = {
        k: str(v) if v is not None else ""
        for k, v in data["fields"].items()
    }

    return data


# ============================================================
# 7. WORD TEMPLATE FILLER
# ============================================================

def fill_word_template(
    template_path: str,
    parsed: Dict,
    output_path: str,
) -> str:
    """
    Điền giá trị từ JSON đã parse vào Word template (.docx).

    Placeholder trong .docx phải có dạng {{FIELD_NAME}}.
    Tất cả field (kể cả NOI_DUNG_*) lấy từ parsed["fields"].

    Hỗ trợ map linh hoạt giữa tên field ở RAG và DOCX template bằng cách
    chuẩn hóa key (bỏ ký tự phân tách như _, -, khoảng trắng).

    Args:
        template_path: Đường dẫn .docx template (có chứa {{FIELD_NAME}})
        parsed       : Dict từ parse_llm_json()
        output_path  : Đường dẫn file .docx kết quả

    Returns:
        output_path (string)

    Raises:
        ImportError nếu python-docx chưa được cài
    """
    try:
        from docx import Document
    except ImportError:
        raise ImportError(
            "python-docx chưa được cài. Chạy: pip install python-docx"
        )

    mapping: Dict[str, str] = {
        str(k).strip(): str(v) if v is not None else ""
        for k, v in dict(parsed.get("fields", {})).items()
    }

    def _normalize_field_key(name: str) -> str:
        return re.sub(r"[^A-Za-z0-9]+", "", name).upper()

    normalized_mapping: Dict[str, str] = {}
    for key in mapping:
        normalized_mapping.setdefault(_normalize_field_key(key), key)

    placeholder_pattern = re.compile(r"\{\{\s*([^}]+?)\s*\}\}")
    unresolved_placeholders: set[str] = set()

    def _resolve_placeholder(raw_key: str) -> Optional[str]:
        key = raw_key.strip()
        if key in mapping:
            return mapping[key]

        alias = normalized_mapping.get(_normalize_field_key(key))
        if alias is not None:
            return mapping[alias]

        unresolved_placeholders.add(key)
        return None

    def _replace_text(text: str) -> tuple[str, bool]:
        changed = False

        def _sub(match: re.Match) -> str:
            nonlocal changed
            value = _resolve_placeholder(match.group(1))
            if value is None:
                return match.group(0)
            changed = True
            return value

        replaced = placeholder_pattern.sub(_sub, text)
        return replaced, changed

    doc           = Document(template_path)
    replace_count = 0

    def _replace_para(para) -> bool:
        full_text = "".join(r.text for r in para.runs)
        if not placeholder_pattern.search(full_text):
            return False

        changed = False
        for run in para.runs:
            new_text, run_changed = _replace_text(run.text)
            if run_changed:
                run.text = new_text
                changed = True

        # Fallback: xử lý placeholder bị Word split thành nhiều run
        if not changed and para.runs:
            new_full, full_changed = _replace_text(full_text)
            if full_changed:
                first_run = para.runs[0]
                first_bold   = first_run.bold
                first_italic = first_run.italic
                first_font   = first_run.font.name
                first_size   = first_run.font.size
                first_run.text = new_full
                first_run.bold        = first_bold
                first_run.italic      = first_italic
                first_run.font.name   = first_font
                first_run.font.size   = first_size
                for r in para.runs[1:]:
                    r.text = ""
                changed = True

        return changed

    for para in doc.paragraphs:
        if _replace_para(para):
            replace_count += 1

    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    if _replace_para(para):
                        replace_count += 1

    for section in doc.sections:
        for para in section.header.paragraphs:
            if _replace_para(para):
                replace_count += 1
        for para in section.footer.paragraphs:
            if _replace_para(para):
                replace_count += 1

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    doc.save(output_path)

    if unresolved_placeholders:
        unresolved = sorted(unresolved_placeholders)
        preview = ", ".join(unresolved[:20])
        more = "" if len(unresolved) <= 20 else f", ... (+{len(unresolved) - 20})"
        print(f"[WARN] Placeholder chưa có dữ liệu: {preview}{more}")

    print(f"[OK] Đã lưu Word: {output_path}  ({replace_count} đoạn được thay thế)")
    return output_path


# ============================================================
# 8. UTILITIES — tương thích với generatePrompt.py
# ============================================================

def find_unfilled_placeholders(text: str) -> List[str]:
    """Tìm {{FIELD_NAME}} còn sót lại trong văn bản."""
    return re.findall(r"\{\{([^}]+)\}\}", text)


def get_context_stats(retrieved: Dict[str, List[Dict]]) -> Dict[str, int]:
    """Thống kê số chunks retrieved theo loại."""
    return {
        "legal"   : len(retrieved.get("legal", [])),
        "form"    : len(retrieved.get("form", [])),
        "examples": len(retrieved.get("examples", [])),
    }


def is_legal_qa_mode(retrieved: Dict[str, List[Dict]]) -> bool:
    """Kiểm tra dict retrieved có phải từ chế độ hỏi luật không."""
    return bool(retrieved.get("legal")) and not retrieved.get("form") and not retrieved.get("examples")