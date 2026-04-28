"""
rag_cli.py
==========
Interactive CLI cho RAG pipeline soạn thảo Văn bản Hành chính Việt Nam.
Init retriever 1 lần → menu vòng lặp → retrieve → xuất file .txt.

Cách chạy:
    python rag_cli.py
    python rag_cli.py --no-reranker    # Tắt reranker (dev mode, nhanh hơn ~3x)
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import os
import re
import textwrap
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dotenv import load_dotenv
load_dotenv()

# ════════════════════════════════════════════════════════════════
# ANSI COLORS — tắt tự động nếu terminal không hỗ trợ
# ════════════════════════════════════════════════════════════════
_USE_COLOR = sys.stdout.isatty() and os.name != "nt" or (
    os.name == "nt" and os.environ.get("WT_SESSION")  # Windows Terminal
)
disable_llm = False

def _c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _USE_COLOR else text

def bold(t):    return _c("1",     t)
def dim(t):     return _c("2",     t)
def green(t):   return _c("32",    t)
def yellow(t):  return _c("33",    t)
def cyan(t):    return _c("36",    t)
def red(t):     return _c("31",    t)
def magenta(t): return _c("35",    t)
def b_green(t): return _c("1;32",  t)
def b_cyan(t):  return _c("1;36",  t)
def b_yellow(t):return _c("1;33",  t)
def b_red(t):   return _c("1;31",  t)


# ════════════════════════════════════════════════════════════════
# IMPORT CÁC MODULE CỦA DỰ ÁN
# ════════════════════════════════════════════════════════════════
try:
    from hybrid_retrieval import init_retriever, retrieve_all, retrieve_legal
except ImportError as e:
    print(red(f"✗ Không import được hybrid_retrieval.py: {e}"))
    print(dim("  → Hãy đặt rag_cli.py cùng thư mục với hybrid_retrieval.py"))
    sys.exit(1)

try:
    from promptTemplates import (
        SYSTEM_PROMPT,
        build_messages,
        build_legal_qa_messages,
        parse_llm_json,
        fill_word_template,
        find_unfilled_placeholders,
        get_context_stats,
    )
except ImportError as e:
    print(red(f"✗ Không import được promptTemplates.py: {e}"))
    sys.exit(1)


# ════════════════════════════════════════════════════════════════
# CONSTANTS & CONFIG
# ════════════════════════════════════════════════════════════════
OUTPUT_DIR   = Path("output_prompts")
VERSION      = "1.1.0"
W            = 64   # độ rộng box

# ════════════════════════════════════════════════════════════════
# LLM API CONFIG
# Cấu hình tại đây hoặc qua biến môi trường:
#   GROQ_API_KEY     → dùng Groq  (ưu tiên cao nhất)
#   OPENAI_API_KEY   → dùng OpenAI
#   LLM_MODEL        → tên model (mặc định bên dưới)
# ════════════════════════════════════════════════════════════════
LLM_CONFIG = {
    "groq_model"      : os.environ.get("LLM_MODEL", "llama-3.3-70b-versatile"),
    "openai_model"    : os.environ.get("LLM_MODEL", "gpt-4o-mini"),
    "max_tokens"      : 9012,
    "temperature"     : 0.1,   # thấp để JSON ổn định
}

# ════════════════════════════════════════════════════════════════
# GROQ SESSION CACHE — chỉ gửi system prompt 1 lần/phiên
# Key: hash của system_msg → conversation history đã gửi
# ════════════════════════════════════════════════════════════════
_groq_session: Dict[str, List[Dict[str, str]]] = {}


def _call_llm_api(
    messages: List[Dict[str, str]],
    state: "SessionState",
    disabled = disable_llm
) -> Optional[str]:
    """
    Gọi LLM API và trả về raw text response (JSON string từ LLM).

    Ưu tiên provider theo thứ tự:
      1. GROQ_API_KEY      → Groq  (nhanh, rẻ — system prompt chỉ gửi 1 lần/phiên)
      2. OPENAI_API_KEY    → OpenAI
    Nếu không có key nào → trả None (chỉ lưu prompt, không gọi LLM).

    Args:
        messages: List messages từ build_messages()  [{"role": ..., "content": ...}]
        state   : SessionState hiện tại

    Returns:
        Raw string từ LLM, hoặc None nếu bỏ qua
    """
    import hashlib

    if disabled:
        warn("LLM API calls are currently DISABLED (for testing prompt generation without hitting API).")
        warn("Set disabled=False in _call_llm_api() to enable actual API calls.")
        return None

    groq_key      = os.environ.get("GROQ_API_KEY", "")
    openai_key    = os.environ.get("OPENAI_API_KEY", "")

    if not groq_key and not openai_key:
        warn("Không có API key — bỏ qua gọi LLM (chỉ lưu prompt files).")
        warn("Set GROQ_API_KEY, OPENAI_API_KEY để bật tính năng này.")
        return None

    # ── Groq ─────────────────────────────────────────────────────
    # Tối ưu token: system prompt CHỈ gửi 1 lần đầu mỗi phiên.
    # Các lần sau, system prompt được đưa vào conversation history
    # thay vì lặp lại trong mỗi request → tiết kiệm đáng kể token.
    if groq_key:
        try:
            from groq import Groq
        except ImportError:
            warn("groq chưa được cài. Chạy: pip install groq")
            # Không return None — thử fallback sang provider khác bên dưới
        else:
            info(f"Gọi Groq API ({LLM_CONFIG['groq_model']})...")

            # Tách system và user message
            system_msg = next((m["content"] for m in messages if m["role"] == "system"), "")
            user_msg   = next((m["content"] for m in messages if m["role"] == "user"),   "")

            # Hash system prompt để nhận dạng "phiên" (khác system = context mới)
            sys_hash = hashlib.md5(system_msg.encode()).hexdigest()

            if sys_hash not in _groq_session:
                # Lần đầu gặp system prompt này → khởi tạo session với system message
                info("  [Groq] Lần đầu gửi system prompt cho phiên này.")
                _groq_session[sys_hash] = [
                    {"role": "system", "content": system_msg},
                ]
            else:
                info("  [Groq] Tái sử dụng session — KHÔNG gửi lại system prompt (tiết kiệm token).")

            # Thêm user message vào session hiện tại
            session_msgs = _groq_session[sys_hash] + [
                {"role": "user", "content": user_msg},
            ]

            try:
                client   = Groq(api_key=groq_key)
                response = client.chat.completions.create(
                    model       = LLM_CONFIG["groq_model"],
                    messages    = session_msgs,
                    max_tokens  = LLM_CONFIG["max_tokens"],
                    temperature = LLM_CONFIG["temperature"],
                )
                reply = response.choices[0].message.content or ""

                # Lưu cặp user↔assistant vào session để dùng cho turn tiếp theo
                _groq_session[sys_hash].append({"role": "user",      "content": user_msg})
                _groq_session[sys_hash].append({"role": "assistant", "content": reply})

                # Thống kê token nếu Groq trả về usage
                usage = getattr(response, "usage", None)
                if usage:
                    info(f"  [Groq] Tokens — prompt: {usage.prompt_tokens}, "
                         f"completion: {usage.completion_tokens}, "
                         f"total: {usage.total_tokens}")

                return reply
            except Exception as e:
                warn(f"Groq API lỗi: {e}")
                return None

    # ── OpenAI ────────────────────────────────────────────────────
    if openai_key:
        try:
            import openai
        except ImportError:
            warn("openai chưa được cài. Chạy: pip install openai")
            return None

        info(f"Gọi OpenAI API ({LLM_CONFIG['openai_model']})...")
        try:
            client   = openai.OpenAI(api_key=openai_key)
            response = client.chat.completions.create(
                model       = LLM_CONFIG["openai_model"],
                messages    = messages,
                max_tokens  = LLM_CONFIG["max_tokens"],
                temperature = LLM_CONFIG["temperature"],
                response_format={"type": "json_object"},   # enforce JSON mode
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            warn(f"OpenAI API lỗi: {e}")
            return None

    return None

# ════════════════════════════════════════════════════════════════
# TEST QUERIES — 6 kịch bản sẵn
# ════════════════════════════════════════════════════════════════
TEST_QUERIES: List[Dict] = [
    {
        "slug" : "01_cong_van_huong_dan_luat",
        "label": "Công văn — Hướng dẫn thi hành Luật",
        "form" : "Form_05",
        "query": (
            "Soạn công văn của Cục Văn thư và Lưu trữ Nhà nước gửi các Bộ, cơ quan ngang Bộ "
            "về việc hướng dẫn triển khai thi hành Luật Lưu trữ mới. Yêu cầu các cơ quan, tổ chức "
            "khẩn trương rà soát, cập nhật quy chế công tác văn thư, lưu trữ nội bộ đảm bảo "
            "đúng quy định của Luật và các Nghị định hướng dẫn thi hành."
        ),
        "extra": (
            "Ngày ký: 05/01/2026\n"
            "Người ký: Cục trưởng Đặng Thanh Tùng\n"
            "Số công văn: 12/VTLT-NV"
        ),
    },
    {
        "slug" : "02_quyet_dinh_bo_nhiem_cong_chuc",
        "label": "Quyết định — Bổ nhiệm công chức (theo Nghị định)",
        "form" : "Form_02",
        "query": (
            "Soạn thảo quyết định về việc bổ nhiệm công chức lãnh đạo, quản lý."
        ),
        "extra": (
            "Cơ quan ban hành: Sở Nội vụ tỉnh Bình Dương.\n"
            "Số quyết định: 45/QĐ-SNV. Ngày ký: 20/01/2026.\n"
            "Người ký: Giám đốc Sở Nội vụ - Trần Thị Mai.\n"
            "Đối tượng bổ nhiệm: Ông Nguyễn Văn Hùng.\n"
            "Chức vụ bổ nhiệm: Trưởng phòng Hành chính - Tổng hợp."
        ),
    },
    {
        "slug" : "03_giay_moi_hop_pho_bien_phap_luat",
        "label": "Giấy mời — Hội nghị phổ biến Luật/Nghị định",
        "form" : "Form_07",
        "query": (
            "Soạn giấy mời họp Ban Giám đốc và Trưởng các phòng ban tham dự Hội nghị phổ biến, "
            "quán triệt các điểm mới của Luật Đất đai và các Nghị định hướng dẫn thi hành "
            "do Sở Tài nguyên và Môi trường tổ chức. Cuộc họp diễn ra lúc 8h00 ngày 15/07/2026."
        ),
        "extra": (
            "Ngày phát hành giấy mời: 10/07/2026\n"
            "Người ký: Giám đốc Phạm Quốc Bảo\n"
            "Số giấy mời: 32/GM-STNMT\n"
            "Địa điểm: Phòng họp tầng 3, Sở TNMT"
        ),
    },
    {
        "slug" : "04_to_trinh_ban_hanh_nghi_quyet",
        "label": "Tờ trình — Đề nghị ban hành Nghị quyết HĐND",
        "form" : "Form_04",
        "query": (
            "Soạn tờ trình của UBND tỉnh Hà Nam trình Hội đồng nhân dân tỉnh xem xét, "
            "ban hành Nghị quyết quy định chính sách hỗ trợ đối với cán bộ, công chức "
            "cấp xã dôi dư do sắp xếp đơn vị hành chính cấp xã, căn cứ theo các "
            "Nghị quyết của Ủy ban Thường vụ Quốc hội và pháp luật hiện hành."
        ),
        "extra": (
            "Ngày trình: 15/03/2026\n"
            "Người ký: Chủ tịch UBND tỉnh - Lê Văn A\n"
            "Số tờ trình: 18/TTr-UBND"
        ),
    },
    {
        "slug" : "05_bien_ban_hop_ky_luat",
        "label": "Biên bản — Họp xét kỷ luật công chức",
        "form" : "Form_09",
        "query": (
            "Soạn thảo biên bản họp Hội đồng kỷ luật công chức."
        ),
        "extra": (
            "Cơ quan: Sở Y tế tỉnh Phú Thọ.\n"
            "Đối tượng bị xem xét: Ông Nguyễn Văn Hải, chức vụ Chuyên viên phòng Tổ chức cán bộ.\n"
            "Hành vi vi phạm: Vi phạm quy định về thời giờ làm việc, tự ý nghỉ việc không có lý do chính đáng "
            "tổng cộng 05 ngày làm việc trong một tháng, gây ảnh hưởng đến tiến độ giải quyết hồ sơ công vụ.\n"
            "Thời gian: 14h00 ngày 20/03/2026. Địa điểm: Phòng họp Ban Giám đốc Sở Y tế Phú Thọ.\n"
            "Hội đồng kỷ luật: \n"
            "1. BS. Nguyễn Đức Thắng (Chủ tịch Hội đồng - Giám đốc Sở)\n"
            "2. Bà Trần Thị Lan (Thư ký Hội đồng - Trưởng phòng TC-CB)\n"
            "3. Và 03 thành viên khác theo Quyết định số 45/QĐ-SYT ngày 10/03/2026.\n"
            "Diễn biến chính: Hội đồng xác định hành vi của ông Hải là tái phạm sau khi đã bị nhắc nhở bằng văn bản. "
            "Ông Hải thừa nhận khuyết điểm và hứa sửa chữa. \n"
            "Kết quả: Hội đồng tiến hành bỏ phiếu kín. Kết quả 05/05 phiếu (100%) thống nhất kiến nghị hình thức Cảnh cáo."
        ),
    },
    {
        "slug" : "06_bao_cao_thi_hanh_nghi_dinh",
        "label": "Báo cáo — Kết quả thi hành Nghị định",
        "form" : "Form_04",
        "query": (
            "Soạn báo cáo của UBND huyện Gia Lâm, thành phố Hà Nội về tổng kết 03 năm "
            "triển khai thực hiện Nghị định số 45/2020/NĐ-CP của Chính phủ về thực hiện "
            "thủ tục hành chính trên môi trường điện tử. Báo cáo cần nêu rõ kết quả đạt được, "
            "những tồn tại, hạn chế và đề xuất, kiến nghị."
        ),
        "extra": (
            "Ngày báo cáo: 20/12/2025d\n"
            "Người ký: Chủ tịch UBND huyện - Đặng Văn Cường\n"
            "Số báo cáo: 156/BC-UBND"
        ),
    },
]


# ════════════════════════════════════════════════════════════════
# TRẠNG THÁI PHIÊN — settings có thể thay đổi trong runtime
# ════════════════════════════════════════════════════════════════
class SessionState:
    def __init__(self, use_reranker: bool = True):
        self.use_reranker    : bool          = use_reranker
        self.legal_top_k     : int           = 4
        self.examples_top_k  : int           = 1
        self.expand_legal    : bool          = True
        self.mode            : str           = "draft"   # "draft" | "legal_qa"
        self.run_id          : str           = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.history         : List[Dict]    = []   # các run đã thực hiện
        self.retriever_ready : bool          = False


# ════════════════════════════════════════════════════════════════
# UI HELPERS
# ════════════════════════════════════════════════════════════════

def clear():
    os.system("cls" if os.name == "nt" else "clear")

def hr(char="─", width=W, color=dim):
    print(color(char * width))

def box_top(color=cyan):
    print(color("╔" + "═" * (W - 2) + "╗"))

def box_bot(color=cyan):
    print(color("╚" + "═" * (W - 2) + "╝"))

def box_row(text: str, color=cyan, text_color=None):
    inner_w = W - 4
    display = text[:inner_w]
    pad     = inner_w - len(display)
    line    = f" {display}{' ' * pad} "
    tc      = text_color or (lambda x: x)
    print(color("║") + tc(line) + color("║"))

def box_blank(color=cyan):
    box_row("", color)

def banner(state: SessionState):
    clear()
    box_top()
    box_row(bold("  RAG CLI — Soạn thảo Văn bản Hành chính Việt Nam"), color=cyan, text_color=bold)
    box_row(f"  v{VERSION}  |  Run: {state.run_id}", color=cyan, text_color=dim)
    box_blank()
    rk = b_green("BẬT") if state.use_reranker else b_yellow("TẮT (dev mode)")
    mode_str = (b_cyan("⚖ Hỏi Luật") if state.mode == "legal_qa"
                else b_green("✍ Soạn thảo"))
    box_row(f"  Chế độ: {mode_str}  |  Reranker: {rk}  |  Legal top-k: {state.legal_top_k}", color=cyan)
    if state.mode == "draft":
        box_row(f"  Examples top-k: {state.examples_top_k}  |  Expand legal: {'BẬT' if state.expand_legal else 'TẮT'}", color=cyan)
    retriever_status = b_green("✔ Sẵn sàng") if state.retriever_ready else b_red("✘ Chưa khởi tạo")
    box_row(f"  Retriever: {retriever_status}  |  Output: output_prompts/", color=cyan)
    box_bot()

def prompt(text: str, default: str = "") -> str:
    """Input có hiển thị default."""
    if default:
        hint = dim(f" [{default}]")
        raw = input(cyan("  ❯ ") + text + hint + ": ").strip()
        return raw if raw else default
    return input(cyan("  ❯ ") + text + ": ").strip()

def info(msg: str):
    print(cyan("  ℹ ") + msg)

def ok(msg: str):
    print(b_green("  ✔ ") + msg)

def warn(msg: str):
    print(b_yellow("  ⚠ ") + msg)

def err(msg: str):
    print(b_red("  ✘ ") + msg)

def section(title: str):
    print()
    hr("─")
    print(bold(f"  {title}"))
    hr("─")

def pause():
    input(dim("\n  Nhấn Enter để tiếp tục..."))

# ════════════════════════════════════════════════════════════════
# TOKEN ESTIMATION (approx)
# ════════════════════════════════════════════════════════════════
def estimate_tokens(text: str) -> int:
    """
    Ước lượng số token (rule-of-thumb):
    1 token ≈ 4 chars (English) / 2–3 chars (Vietnamese)
    → dùng trung bình 3.5 cho an toàn
    """
    return int(len(text) / 3.5)


# ════════════════════════════════════════════════════════════════
# CORE LOGIC — retrieve + build + save
# ════════════════════════════════════════════════════════════════


def do_legal_qa_and_save(
    slug: str,
    query: str,
    extra: Optional[str],
    state: SessionState,
) -> Optional[Dict]:
    """
    Chế độ HỎI LUẬT: chỉ retrieve legal (top_k=5), không cần form/example.
    Trả về result dict hoặc None nếu lỗi.
    """
    print()
    info(f"[Chế độ Hỏi Luật] Đang retrieve...  (reranker={'BẬT' if state.use_reranker else 'TẮT'})")
    t0 = time.time()

    legal_top_k = 5   # cố định top_k=5 cho chế độ hỏi luật

    try:
        legal_results = retrieve_legal(
            query,
            top_k        = legal_top_k,
            use_reranker = state.use_reranker,
            expand       = state.expand_legal,
        )
    except Exception as e:
        err(f"retrieve_legal() thất bại: {e}")
        return None

    elapsed = time.time() - t0
    ok(f"Retrieve xong sau {elapsed:.1f}s  (legal={len(legal_results)})")

    # Legal sources
    legal_srcs = []
    for r in legal_results:
        src = (f"{r['metadata'].get('id','?')} — {r['metadata'].get('article','?')} "
               f"(score={r.get('rerank_score',0):.3f})")
        legal_srcs.append(src)
        info(f"  ⚖  {src}")

    # Build messages (legal QA mode — không có form/example)
    messages   = build_legal_qa_messages(query, legal_results, extra_instructions=extra)
    system_msg = messages[0]["content"]
    user_msg   = messages[1]["content"]

    # Prompt stats
    system_tok = estimate_tokens(system_msg)
    user_tok   = estimate_tokens(user_msg)
    total_len  = len(system_msg) + len(user_msg)
    print()
    info("Prompt statistics:")
    info(f"  SYSTEM: {len(system_msg):,} chars  (~{system_tok:,} tokens)")
    info(f"  USER  : {len(user_msg):,} chars  (~{user_tok:,} tokens)")
    info(f"  TOTAL : {total_len:,} chars  (~{system_tok+user_tok:,} tokens)")

    # Ghi prompt files
    OUTPUT_DIR.mkdir(exist_ok=True)
    run_ts   = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    meta_hdr = (
        f"# RAG CLI — {slug}  [CHẾ ĐỘ HỎI LUẬT]\n"
        f"# Run     : {state.run_id}\n"
        f"# Thời điểm: {run_ts}\n"
        f"# Reranker: {'BẬT' if state.use_reranker else 'TẮT'}\n"
        f"# Legal top-k: {legal_top_k}\n"
        f"# Query   : {query[:120]}{'...' if len(query) > 120 else ''}\n"
        f"{'=' * 70}\n\n"
    )
    sep = "\n" + "═" * 70 + "\n"

    files_written = []
    for suffix, content in [
        ("__FULL.txt",   meta_hdr + "## [SYSTEM]\n\n" + system_msg + sep + "## [USER]\n\n" + user_msg),
        ("__USER.txt",   meta_hdr + user_msg),
        ("__SYSTEM.txt", meta_hdr + system_msg),
    ]:
        fpath = OUTPUT_DIR / f"{slug}{suffix}"
        fpath.write_text(content, encoding="utf-8")
        kb = len(content.encode("utf-8")) / 1024
        files_written.append((fpath.name, kb))
        ok(f"  {fpath.name}  ({kb:.1f} KB)")

    # Gọi LLM (response là văn xuôi, không parse JSON)
    llm_response = _call_llm_api(messages, state)

    if llm_response:
        ans_path = OUTPUT_DIR / f"{slug}__ANSWER.txt"
        ans_path.write_text(llm_response, encoding="utf-8")
        kb = ans_path.stat().st_size / 1024
        files_written.append((ans_path.name, kb))
        ok(f"  {ans_path.name}  ({kb:.1f} KB)")
        print()
        info("Câu trả lời từ LLM:")
        hr("─")
        for line in llm_response.splitlines():
            print(f"  {line}")
        hr("─")
    else:
        info("Không có LLM response — chỉ lưu prompt files.")

    result = {
        "slug"                 : slug,
        "query"                : query,
        "extra"                : extra,
        "form_id"              : "N/A (legal_qa)",
        "form_type"            : "N/A",
        "legal_sources"        : legal_srcs,
        "example_scenarios"    : [],
        "unfilled_placeholders": [],
        "parsed"               : None,
        "stats"                : {"legal": len(legal_results), "form": 0, "examples": 0},
        "files_written"        : files_written,
        "elapsed"              : elapsed,
        "mode"                 : "legal_qa",
    }
    state.history.append(result)
    return result


def do_retrieve_and_save(
    slug: str,
    query: str,
    extra: Optional[str],
    state: SessionState,
) -> Optional[Dict]:
    """Routing theo state.mode: 'draft' → soạn thảo, 'legal_qa' → hỏi luật."""
    if state.mode == "legal_qa":
        return do_legal_qa_and_save(slug, query, extra, state)
    return _do_draft_and_save(slug, query, extra, state)


def _do_draft_and_save(
    slug: str,
    query: str,
    extra: Optional[str],
    state: SessionState,
) -> Optional[Dict]:
    """Retrieve → build prompt → ghi file. Trả về result dict hoặc None nếu lỗi."""
    print()
    info(f"Đang retrieve...  (reranker={'BẬT' if state.use_reranker else 'TẮT'})")
    t0 = time.time()

    try:
        retrieved = retrieve_all(
            query,
            legal_top_k    = state.legal_top_k,
            examples_top_k = state.examples_top_k,
            expand_legal   = state.expand_legal,
        )
    except Exception as e:
        err(f"retrieve_all() thất bại: {e}")
        return None

    elapsed = time.time() - t0
    stats   = get_context_stats(retrieved)
    ok(f"Retrieve xong sau {elapsed:.1f}s  "
       f"(legal={stats['legal']}, form={stats['form']}, examples={stats['examples']})")

    # Form info
    form_id   = retrieved["form"][0]["metadata"].get("form_id",   "N/A") if retrieved.get("form") else "N/A"
    form_type = retrieved["form"][0]["metadata"].get("form_type", "N/A") if retrieved.get("form") else "N/A"
    info(f"Form nhận dạng: {bold(form_id)} ({form_type})")

    # Legal sources
    legal_srcs = []
    for r in retrieved.get("legal", []):
        src = (f"{r['metadata'].get('id','?')} — {r['metadata'].get('article','?')} "
               f"(score={r.get('rerank_score',0):.3f})")
        legal_srcs.append(src)
        info(f"  ⚖  {src}")

    # Examples
    example_scenarios = []
    for r in retrieved.get("examples", []):
        sc = r["metadata"].get("scenario", "N/A")
        example_scenarios.append(sc)
        info(f"  📄 VD: {sc[:70]}")

    # Build messages
    messages   = build_messages(query, retrieved, extra_instructions=extra)
    system_msg = messages[0]["content"]
    user_msg   = messages[1]["content"]

    # ── Prompt stats ──────────────────────────────────────────────
    system_len = len(system_msg)
    user_len   = len(user_msg)
    total_len  = system_len + user_len

    system_tok = estimate_tokens(system_msg)
    user_tok   = estimate_tokens(user_msg)
    total_tok  = system_tok + user_tok

    print()
    info("Prompt statistics:")
    info(f"  SYSTEM: {system_len:,} chars  (~{system_tok:,} tokens)")
    info(f"  USER  : {user_len:,} chars  (~{user_tok:,} tokens)")
    info(f"  TOTAL : {total_len:,} chars  (~{total_tok:,} tokens)")

    # ── Ghi prompt files ──────────────────────────────────────────
    OUTPUT_DIR.mkdir(exist_ok=True)
    run_ts   = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    meta_hdr = (
        f"# RAG CLI — {slug}\n"
        f"# Run     : {state.run_id}\n"
        f"# Thời điểm: {run_ts}\n"
        f"# Form    : {form_id} ({form_type})\n"
        f"# Reranker: {'BẬT' if state.use_reranker else 'TẮT'}\n"
        f"# Query   : {query[:120]}{'...' if len(query) > 120 else ''}\n"
        f"{'=' * 70}\n\n"
    )
    sep = "\n" + "═" * 70 + "\n"

    files_written = []
    for suffix, content in [
        ("__FULL.txt",   meta_hdr + "## [SYSTEM]\n\n" + system_msg + sep + "## [USER]\n\n" + user_msg),
        ("__USER.txt",   meta_hdr + user_msg),
        ("__SYSTEM.txt", meta_hdr + system_msg),
    ]:
        fpath = OUTPUT_DIR / f"{slug}{suffix}"
        fpath.write_text(content, encoding="utf-8")
        kb = len(content.encode("utf-8")) / 1024
        files_written.append((fpath.name, kb))
        ok(f"  {fpath.name}  ({kb:.1f} KB)")

    # ── Gọi LLM API và xử lý JSON output ────────────────────────
    llm_response = _call_llm_api(messages, state)
    parsed       = None
    unfilled_ph  = []

    if llm_response:
        # Lưu raw JSON response để debug
        raw_path = OUTPUT_DIR / f"{slug}__RAW.json"
        raw_path.write_text(llm_response, encoding="utf-8")
        kb = len(llm_response.encode("utf-8")) / 1024
        files_written.append((raw_path.name, kb))
        ok(f"  {raw_path.name}  ({kb:.1f} KB)")

        try:
            parsed = parse_llm_json(llm_response)

            # Kiểm tra fields còn trống
            unfilled_ph = [
                k for k, v in parsed["fields"].items() if not v.strip()
            ]
            if unfilled_ph:
                warn(f"Có {len(unfilled_ph)} field chưa điền: "
                     f"{', '.join(unfilled_ph[:5])}"
                     f"{'...' if len(unfilled_ph) > 5 else ''}")
            else:
                ok("Tất cả field đã được điền đầy đủ")

            # Lưu parsed JSON đẹp để kiểm tra
            json_path = OUTPUT_DIR / f"{slug}__PARSED.json"
            json_path.write_text(
                json.dumps(parsed, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            kb = len(json_path.read_bytes()) / 1024
            files_written.append((json_path.name, kb))
            ok(f"  {json_path.name}  ({kb:.1f} KB)")

            # Lưu noi_dung thành .md để preview
            md_path = OUTPUT_DIR / f"{slug}__NOI_DUNG.md"
            md_path.write_text(parsed.get("noi_dung", ""), encoding="utf-8")
            kb = len(md_path.read_bytes()) / 1024
            files_written.append((md_path.name, kb))
            ok(f"  {md_path.name}  ({kb:.1f} KB)")

            # Fill Word nếu tìm thấy template tương ứng
            template_path = Path("templates") / f"{form_id}.docx"
            if template_path.exists():
                docx_out = OUTPUT_DIR / f"{slug}__FILLED.docx"
                try:
                    fill_word_template(str(template_path), parsed, str(docx_out))
                    kb = docx_out.stat().st_size / 1024
                    files_written.append((docx_out.name, kb))
                    ok(f"  {docx_out.name}  ({kb:.1f} KB)")
                except Exception as e:
                    warn(f"Không fill được Word template: {e}")
            else:
                info(f"Không tìm thấy Word template: {template_path} (bỏ qua fill Word)")

        except ValueError as e:
            warn(f"Không parse được JSON từ LLM: {e}")
    else:
        info("Không có LLM response — chỉ lưu prompt files.")

    result = {
        "slug"                 : slug,
        "query"                : query,
        "extra"                : extra,
        "form_id"              : form_id,
        "form_type"            : form_type,
        "legal_sources"        : legal_srcs,
        "example_scenarios"    : example_scenarios,
        "unfilled_placeholders": unfilled_ph,
        "parsed"               : parsed,
        "stats"                : stats,
        "files_written"        : files_written,
        "elapsed"              : elapsed,
    }
    state.history.append(result)
    return result


# ════════════════════════════════════════════════════════════════
# MENU: CHẠY QUERY CÓ SẴN
# ════════════════════════════════════════════════════════════════

def menu_preset(state: SessionState):
    while True:
        banner(state)
        section("CHẠY QUERY CÓ SẴN")

        print(f"  {'#':<4} {'Loại form':<12} {'Mô tả'}")
        hr("─")
        for i, q in enumerate(TEST_QUERIES, 1):
            label = q["label"]
            form  = dim(f"({q['form']})")
            print(f"  {cyan(str(i)):<14} {form:<20} {label}")

        hr("─")
        print(f"  {cyan('A'):<14} {'':20} Chạy TẤT CẢ 6 query")
        print(f"  {cyan('0'):<14} {'':20} ← Quay lại menu chính")
        hr("─")

        choice = prompt("Chọn số thứ tự hoặc A/0").upper()

        if choice == "0":
            return

        if choice == "A":
            # Chạy tất cả
            banner(state)
            section(f"CHẠY TẤT CẢ {len(TEST_QUERIES)} QUERY")
            t_all = time.time()
            for i, q in enumerate(TEST_QUERIES, 1):
                print(f"\n  {bold(f'[{i}/{len(TEST_QUERIES)}]')} {q['label']}")
                do_retrieve_and_save(q["slug"], q["query"], q.get("extra"), state)
            total = time.time() - t_all
            print()
            ok(f"Hoàn thành tất cả {len(TEST_QUERIES)} query sau {total:.1f}s")
            _print_usage_hint()
            pause()
            return

        if choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(TEST_QUERIES):
                q = TEST_QUERIES[idx]
                banner(state)
                section(f"CHẠY: {q['label']}")
                print(f"  {dim('Query:')}")
                for line in textwrap.wrap(q["query"], W - 4):
                    print(f"    {line}")
                if q.get("extra"):
                    print(f"  {dim('Extra:')}")
                    for line in q["extra"].splitlines():
                        print(f"    {line}")
                print()

                do_retrieve_and_save(q["slug"], q["query"], q.get("extra"), state)
                _print_usage_hint()
                pause()
                continue

        err(f"Lựa chọn không hợp lệ: '{choice}'")
        time.sleep(1)


# ════════════════════════════════════════════════════════════════
# MENU: NHẬP QUERY TUỲ CHỈNH
# ════════════════════════════════════════════════════════════════

def menu_custom(state: SessionState):
    banner(state)
    section("NHẬP QUERY TUỲ CHỈNH")

    info("Nhập mô tả nhu cầu soạn thảo (Enter 2 lần để kết thúc):")
    print()
    lines = []
    while True:
        line = input("    ")
        if line == "" and lines and lines[-1] == "":
            break
        lines.append(line)
    query = "\n".join(lines).strip()

    if not query:
        warn("Query trống — huỷ.")
        pause()
        return

    print()
    info("Nhập extra instructions (ngày ký, người ký, số VB…)  — để trống nếu không có:")
    info("  Ví dụ:  Ngày ký: 01/01/2025 | Người ký: Giám đốc Nguyễn Văn A")
    extra_lines = []
    while True:
        line = input("    ")
        if line == "" and (not extra_lines or extra_lines[-1] == ""):
            break
        extra_lines.append(line)
    extra = "\n".join(extra_lines).strip() or None

    # Tên file slug
    default_slug = "custom_" + datetime.now().strftime("%H%M%S")
    slug_raw     = prompt("Tên file output (slug)", default_slug)
    slug         = re.sub(r"[^a-zA-Z0-9_\-]", "_", slug_raw).strip("_") or default_slug

    print()
    section(f"ĐANG XỬ LÝ: {slug}")
    do_retrieve_and_save(slug, query, extra, state)
    _print_usage_hint()
    pause()


# ════════════════════════════════════════════════════════════════
# MENU: CÀI ĐẶT
# ════════════════════════════════════════════════════════════════

def menu_settings(state: SessionState):
    while True:
        banner(state)
        section("CÀI ĐẶT")

        rk_status   = b_green("BẬT") if state.use_reranker else b_yellow("TẮT")
        ex_status   = b_green("BẬT") if state.expand_legal  else b_yellow("TẮT")
        mode_status = (b_cyan("⚖ Hỏi Luật (top-k=5, không form/example)")
                       if state.mode == "legal_qa"
                       else b_green("✍ Soạn thảo văn bản (đầy đủ)"))

        groq_sessions = len(_groq_session)
        groq_cache_str = (b_green(f"{groq_sessions} session đang cache")
                          if groq_sessions else dim("(chưa có session)"))

        print(f"  {cyan('1')}  Chế độ             : {mode_status}")
        print(f"  {cyan('2')}  Reranker           : {rk_status}")
        print(f"  {cyan('3')}  Legal top-k        : {bold(str(state.legal_top_k))}  (1–10, chỉ áp dụng chế độ Soạn thảo)")
        print(f"  {cyan('4')}  Examples top-k     : {bold(str(state.examples_top_k))}  (1–10)")
        print(f"  {cyan('5')}  Expand legal chunks: {ex_status}")
        print(f"  {cyan('6')}  Groq session cache : {groq_cache_str}  {dim('← reset để gửi lại system prompt')}")
        print()
        print(f"  {cyan('0')}  ← Quay lại menu chính")
        hr("─")

        c = prompt("Chọn mục cần thay đổi").strip()

        if c == "0":
            return

        elif c == "1":
            state.mode = "legal_qa" if state.mode == "draft" else "draft"
            if state.mode == "legal_qa":
                ok("Chế độ → ⚖ Hỏi Luật  (legal top-k=5, bỏ form & example)")
            else:
                ok("Chế độ → ✍ Soạn thảo văn bản")
            time.sleep(1.0)

        elif c == "2":
            state.use_reranker = not state.use_reranker
            status = b_green("BẬT") if state.use_reranker else b_yellow("TẮT")
            ok(f"Reranker → {status}")
            time.sleep(0.8)

        elif c == "3":
            v = prompt(f"Legal top-k mới", str(state.legal_top_k))
            if v.isdigit() and 1 <= int(v) <= 10:
                state.legal_top_k = int(v)
                ok(f"Legal top-k → {state.legal_top_k}")
            else:
                err("Giá trị không hợp lệ (phải từ 1–10)")
            time.sleep(0.8)

        elif c == "4":
            v = prompt(f"Examples top-k mới", str(state.examples_top_k))
            if v.isdigit() and 1 <= int(v) <= 10:
                state.examples_top_k = int(v)
                ok(f"Examples top-k → {state.examples_top_k}")
            else:
                err("Giá trị không hợp lệ (phải từ 1–10)")
            time.sleep(0.8)

        elif c == "5":
            state.expand_legal = not state.expand_legal
            status = b_green("BẬT") if state.expand_legal else b_yellow("TẮT")
            ok(f"Expand legal → {status}")
            time.sleep(0.8)

        elif c == "6":
            _groq_session.clear()
            ok("Đã reset Groq session cache — system prompt sẽ được gửi lại lần tới.")
            time.sleep(0.8)

        else:
            err(f"Lựa chọn không hợp lệ: '{c}'")
            time.sleep(0.8)


# ════════════════════════════════════════════════════════════════
# MENU: LỊCH SỬ RUN
# ════════════════════════════════════════════════════════════════

def menu_history(state: SessionState):
    banner(state)
    section("LỊCH SỬ PHIÊN NÀY")

    if not state.history:
        warn("Chưa có run nào trong phiên này.")
        pause()
        return

    for i, r in enumerate(state.history, 1):
        print(f"\n  {bold(f'[{i}]')} {cyan(r['slug'])}")
        print(f"       Form    : {r['form_id']} ({r['form_type']})")
        print(f"       Elapsed : {r['elapsed']:.1f}s")
        print(f"       Legal   : {len(r['legal_sources'])} điều khoản")
        for src in r["legal_sources"]:
            print(f"                 • {dim(src)}")
        print(f"       Examples: {len(r['example_scenarios'])} ví dụ")
        for sc in r["example_scenarios"]:
            print(f"                 • {dim(sc[:60])}")
        print(f"       Files   :")
        for fname, kb in r["files_written"]:
            print(f"                 ✅ {fname}  ({kb:.1f} KB)")

    # Ghi summary file
    print()
    if len(state.history) > 0:
        _write_summary(state)
        ok(f"Summary đã lưu → output_prompts/rag_test_summary.txt")
    pause()


def _write_summary(state: SessionState):
    lines = [
        f"RAG CLI SUMMARY — Run {state.run_id}",
        f"Thời điểm     : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"Reranker      : {'BẬT' if state.use_reranker else 'TẮT'}",
        f"Legal top-k   : {state.legal_top_k}",
        f"Examples top-k: {state.examples_top_k}",
        f"Số run        : {len(state.history)}",
        "=" * 70, "",
    ]
    for r in state.history:
        lines += [
            f"[{r['slug']}]",
            f"  Form   : {r['form_id']} ({r['form_type']})",
            f"  Elapsed: {r['elapsed']:.1f}s",
            f"  Legal  : {len(r['legal_sources'])} điều khoản",
        ]
        for src in r["legal_sources"]:
            lines.append(f"    - {src}")
        lines.append(f"  Examples: {len(r['example_scenarios'])}")
        for sc in r["example_scenarios"]:
            lines.append(f"    - {sc}")
        if r.get("unfilled_placeholders"):
            lines.append(f"  Unfilled: {r['unfilled_placeholders']}")
        lines.append(f"  Files:")
        for fname, kb in r["files_written"]:
            lines.append(f"    ✅ {fname}  ({kb:.1f} KB)")
        lines.append("")

    lines += [
        "=" * 70,
        "HƯỚNG DẪN SỬ DỤNG FILE OUTPUT:",
        "",
        "Cách 1 — ChatGPT / Gemini (web chat thông thường):",
        "  → Mở __FULL.txt → Copy toàn bộ → Paste vào ô chat → Gửi",
        "",
        "Cách 2 — Gemini Advanced (System Instruction):",
        "  → Dán __SYSTEM.txt vào 'System Instructions'",
        "  → Dán __USER.txt vào ô chat → Gửi",
        "",
        "Cách 3 — ChatGPT (Custom Instructions):",
        "  → Settings → Custom Instructions → dán __SYSTEM.txt",
        "  → Dán __USER.txt vào ô chat → Gửi",
    ]

    OUTPUT_DIR.mkdir(exist_ok=True)
    (OUTPUT_DIR / "rag_test_summary.txt").write_text("\n".join(lines), encoding="utf-8")


def _print_usage_hint():
    print()
    hr("─")
    print(bold("  HƯỚNG DẪN SỬ DỤNG FILE OUTPUT:"))
    print(f"  {cyan('__FULL.txt')}   → Copy toàn bộ, paste thẳng vào ChatGPT/Gemini")
    print(f"  {cyan('__USER.txt')}   → Paste vào ô chat (khi đã set System Instruction riêng)")
    print(f"  {cyan('__SYSTEM.txt')} → Dán vào Custom Instructions / System Instruction")
    hr("─")


# ════════════════════════════════════════════════════════════════
# MENU CHÍNH
# ════════════════════════════════════════════════════════════════

def main_menu(state: SessionState):
    while True:
        banner(state)
        section("MENU CHÍNH")

        hist_label = f"Lịch sử phiên ({len(state.history)} run)" if state.history else "Lịch sử phiên"

        entries = [
            ("1", "Chạy query có sẵn",     "6 kịch bản soạn thảo mẫu"),
            ("2", "Nhập query tuỳ chỉnh",  "Soạn thảo theo yêu cầu riêng"),
            ("3", "Cài đặt",               "Reranker, top-k, expand..."),
            ("4", hist_label,              "Xem & lưu summary"),
            ("0", "Thoát",                 ""),
        ]

        for key, label, desc in entries:
            desc_str = dim(f"  — {desc}") if desc else ""
            print(f"  {cyan(key)}  {bold(label)}{desc_str}")

        hr("─")
        c = prompt("Chọn chức năng").strip()

        if c == "1":
            if not state.retriever_ready:
                err("Retriever chưa sẵn sàng! (Không nên xảy ra — kiểm tra init)")
                pause()
            else:
                menu_preset(state)

        elif c == "2":
            if not state.retriever_ready:
                err("Retriever chưa sẵn sàng!")
                pause()
            else:
                menu_custom(state)

        elif c == "3":
            menu_settings(state)

        elif c == "4":
            menu_history(state)

        elif c == "0":
            banner(state)
            if state.history:
                print()
                info(f"Phiên kết thúc — đã thực hiện {len(state.history)} run.")
                _write_summary(state)
                ok("Summary đã lưu → output_prompts/rag_test_summary.txt")
            print()
            ok("Tạm biệt! 👋")
            print()
            sys.exit(0)

        else:
            err(f"Lựa chọn không hợp lệ: '{c}'")
            time.sleep(0.8)


# ════════════════════════════════════════════════════════════════
# ENTRYPOINT
# ════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="RAG CLI — Soạn thảo Văn bản Hành chính Việt Nam"
    )
    parser.add_argument(
        "--no-reranker", action="store_true",
        help="Tắt reranker khi khởi động (dev mode, nhanh hơn ~3x)",
    )
    args = parser.parse_args()

    state = SessionState(use_reranker=not args.no_reranker)

    # ── Splash + init ──────────────────────────────────────────
    clear()
    box_top()
    box_row(bold("  RAG CLI — Soạn thảo Văn bản Hành chính VN"), color=cyan, text_color=bold)
    box_row(f"  v{VERSION}", color=cyan, text_color=dim)
    box_blank()
    box_row(f"  Đang khởi tạo retriever... vui lòng chờ", color=cyan, text_color=yellow)
    box_bot()
    print()

    if args.no_reranker:
        warn("Dev mode: Reranker TẮT — kết quả nhanh hơn nhưng ít chính xác hơn")
        print()

    info("Bước 1/3 — Load dataset chunks (parquet)...")
    info("Bước 2/3 — Build / load BM25 index...")
    info("Bước 3/3 — Load embedding model & reranker...")
    print()

    t0 = time.time()
    try:
        init_retriever(force_rebuild_bm25=False)
        elapsed = time.time() - t0
        state.retriever_ready = True
        ok(f"Retriever sẵn sàng sau {elapsed:.1f}s")
    except Exception as e:
        err(f"Không thể khởi tạo retriever: {e}")
        err("Kiểm tra lại paths dataset/, chromadb/, models/ trong hybrid_retrieval.py")
        sys.exit(1)

    OUTPUT_DIR.mkdir(exist_ok=True)
    info(f"Output directory: {OUTPUT_DIR.resolve()}")
    time.sleep(1.2)

    # ── Vào menu vòng lặp ─────────────────────────────────────
    main_menu(state)


if __name__ == "__main__":
    main()