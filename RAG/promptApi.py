"""
promptAPI.py
============
API layer kết nối hybrid_retrieval + promptTemplates với các module khác trong dự án.

Hai chế độ:
  - "draft"    : Soạn thảo văn bản hành chính → trả về dict (JSON-serializable)
  - "legal_qa" : Hỏi đáp pháp luật            → trả về str (Markdown)

Khởi tạo một lần duy nhất khi start:
    from promptAPI import PromptAPI
    api = PromptAPI()          # load retriever, model (~20-40s lần đầu)

Sau đó gọi từ bất kỳ module nào:
    result = api.draft("Soạn công văn gửi Bộ Tài chính về ngân sách 2025")
    result = api.legal_qa("Thẩm quyền ký công văn theo Nghị định 30/2020 là gì?")

Output:
  - draft()    → {"status": "ok", "fields": {...}, "meta": {...}}  (JSON-ready)
  - legal_qa() → {"status": "ok", "answer": "...",  "meta": {...}} (Markdown string trong "answer")

Tích hợp LLM (tuỳ chọn — không bắt buộc để build prompt):
  Đặt GROQ_API_KEY hoặc OPENAI_API_KEY trong .env hoặc biến môi trường.
  Nếu không có key → trả messages thô trong meta["messages"] để caller tự gọi LLM.
"""

from __future__ import annotations

import json
import os
import time
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════
# IMPORT CÁC MODULE DỰ ÁN
# ═══════════════════════════════════════════════════════════════
try:
    from hybrid_retrieval import init_retriever, retrieve_all, retrieve_legal
except ImportError as e:
    raise ImportError(f"Không import được hybrid_retrieval.py: {e}") from e

try:
    from promptTemplates import (
        build_messages,
        build_legal_qa_messages,
        parse_llm_json,
        get_context_stats,
    )
except ImportError as e:
    raise ImportError(f"Không import được promptTemplates.py: {e}") from e


# ═══════════════════════════════════════════════════════════════
# LLM CONFIG
# ═══════════════════════════════════════════════════════════════
_LLM_CONFIG = {
    "groq_model"  : os.environ.get("LLM_MODEL", "llama-3.3-70b-versatile"),
    "openai_model": os.environ.get("LLM_MODEL", "gpt-4o-mini"),
    "max_tokens"  : 4096,
    "temperature" : 0.1,
}


# ═══════════════════════════════════════════════════════════════
# LLM CALLER (nội bộ)
# ═══════════════════════════════════════════════════════════════
def _call_llm(messages: List[Dict[str, str]]) -> Optional[str]:
    """
    Gọi LLM với messages đã build. Ưu tiên Groq → OpenAI.
    Trả None nếu không có API key hoặc gọi thất bại.
    """
    groq_key   = os.environ.get("GROQ_API_KEY", "")
    openai_key = os.environ.get("OPENAI_API_KEY", "")

    if not groq_key and not openai_key:
        logger.warning("Không có LLM API key — trả messages thô trong meta['messages'].")
        return None

    # ── Groq ────────────────────────────────────────────────────
    if groq_key:
        try:
            from groq import Groq
            client   = Groq(api_key=groq_key)
            response = client.chat.completions.create(
                model       = _LLM_CONFIG["groq_model"],
                messages    = messages,
                max_tokens  = _LLM_CONFIG["max_tokens"],
                temperature = _LLM_CONFIG["temperature"],
            )
            return response.choices[0].message.content or ""
        except ImportError:
            logger.warning("groq chưa cài. Chạy: pip install groq")
        except Exception as e:
            logger.error(f"Groq API lỗi: {e}")
            return None

    # ── OpenAI ──────────────────────────────────────────────────
    if openai_key:
        try:
            import openai
            client   = openai.OpenAI(api_key=openai_key)
            response = client.chat.completions.create(
                model           = _LLM_CONFIG["openai_model"],
                messages        = messages,
                max_tokens      = _LLM_CONFIG["max_tokens"],
                temperature     = _LLM_CONFIG["temperature"],
                response_format = {"type": "json_object"},
            )
            return response.choices[0].message.content or ""
        except ImportError:
            logger.warning("openai chưa cài. Chạy: pip install openai")
        except Exception as e:
            logger.error(f"OpenAI API lỗi: {e}")

    return None


# ═══════════════════════════════════════════════════════════════
# PUBLIC API CLASS
# ═══════════════════════════════════════════════════════════════
class PromptAPI:
    """
    API layer chính. Khởi tạo một lần, dùng nhiều lần.

    Parameters
    ----------
    use_reranker : bool
        Bật CrossEncoder reranker (chính xác hơn, chậm hơn ~3x). Mặc định True.
    legal_top_k : int
        Số điều luật retrieve cho mỗi query. Mặc định 3.
    examples_top_k : int
        Số ví dụ few-shot retrieve. Mặc định 3.
    force_rebuild_bm25 : bool
        Rebuild BM25 index từ đầu (dùng khi dataset thay đổi). Mặc định False.
    """

    def __init__(
        self,
        use_reranker      : bool = True,
        legal_top_k       : int  = 3,
        examples_top_k    : int  = 1,
        force_rebuild_bm25: bool = False,
    ):
        self.use_reranker   = use_reranker
        self.legal_top_k    = legal_top_k
        self.examples_top_k = examples_top_k

        logger.info("PromptAPI: Khởi tạo retriever...")
        t0 = time.time()
        init_retriever(force_rebuild_bm25=force_rebuild_bm25)
        logger.info(f"PromptAPI: Retriever sẵn sàng sau {time.time() - t0:.1f}s")

    # ───────────────────────────────────────────────────────────
    # DRAFT — Soạn thảo văn bản hành chính
    # ───────────────────────────────────────────────────────────
    def draft(
        self,
        query              : str,
        extra_instructions : Optional[str] = None,
        legal_type_filter  : Optional[str] = None,
        call_llm           : bool = True,
    ) -> Dict[str, Any]:
        """
        Soạn thảo văn bản hành chính.

        Parameters
        ----------
        query : str
            Yêu cầu soạn thảo bằng tiếng Việt.
            VD: "Soạn công văn của Cục Văn thư gửi các Bộ về hướng dẫn lưu trữ điện tử"
        extra_instructions : str, optional
            Hướng dẫn bổ sung (ngày ký, tên người ký, số văn bản...).
        legal_type_filter : str, optional
            Lọc loại văn bản pháp luật: "LUẬT" | "NGHỊ ĐỊNH" | "NGHỊ QUYẾT" | "PHÁP LỆNH"
        call_llm : bool
            True  → gọi LLM và trả fields đã điền (cần API key).
            False → chỉ build prompt, trả messages thô trong meta["messages"].

        Returns
        -------
        dict (JSON-serializable):
            Thành công (có LLM):
            {
                "status"  : "ok",
                "mode"    : "draft",
                "fields"  : { "FIELD_1": "...", "NOI_DUNG_CHINH": "...", ... },
                "meta"    : {
                    "query"         : str,
                    "elapsed_s"     : float,
                    "context_stats" : {"legal": int, "form": int, "examples": int},
                    "form_id"       : str,
                    "form_type"     : str,
                    "legal_sources" : [str, ...],
                }
            }
            Không có LLM / call_llm=False:
            {
                "status"  : "prompt_only",
                "mode"    : "draft",
                "fields"  : {},
                "meta"    : { ..., "messages": [{"role": ..., "content": ...}, ...] }
            }
            Lỗi:
            {
                "status"  : "error",
                "mode"    : "draft",
                "error"   : str,
                "meta"    : { "query": str, "elapsed_s": float }
            }
        """
        t0 = time.time()
        try:
            # 1. Retrieve
            retrieved = retrieve_all(
                query,
                legal_top_k       = self.legal_top_k,
                examples_top_k    = self.examples_top_k,
                legal_type_filter = legal_type_filter,
                expand_legal      = True,
            )

            # 2. Build messages
            messages = build_messages(
                query,
                retrieved,
                extra_instructions=extra_instructions,
            )

            # 3. Meta cơ bản
            form_meta   = retrieved["form"][0]["metadata"] if retrieved.get("form") else {}
            legal_sources = [
                r["metadata"].get("source_doc_no", r["metadata"].get("id", "?"))
                for r in retrieved.get("legal", [])
            ]
            meta = {
                "query"         : query,
                "elapsed_s"     : round(time.time() - t0, 2),
                "context_stats" : get_context_stats(retrieved),
                "form_id"       : form_meta.get("form_id", ""),
                "form_type"     : form_meta.get("form_type", ""),
                "legal_sources" : legal_sources,
            }

            # 4. Gọi LLM (nếu bật)
            if not call_llm:
                meta["messages"] = messages
                return {"status": "prompt_only", "mode": "draft", "fields": {}, "meta": meta}

            raw = _call_llm(messages)
            if raw is None:
                meta["messages"] = messages
                return {"status": "prompt_only", "mode": "draft", "fields": {}, "meta": meta}

            # 5. Parse JSON
            parsed = parse_llm_json(raw)
            meta["elapsed_s"] = round(time.time() - t0, 2)
            meta["llm_raw"]   = raw  # giữ lại để debug nếu cần

            return {
                "status": "ok",
                "mode"  : "draft",
                "fields": parsed.get("fields", {}),
                "meta"  : meta,
            }

        except Exception as e:
            logger.exception(f"draft() thất bại: {e}")
            return {
                "status": "error",
                "mode"  : "draft",
                "error" : str(e),
                "meta"  : {"query": query, "elapsed_s": round(time.time() - t0, 2)},
            }

    # ───────────────────────────────────────────────────────────
    # LEGAL QA — Hỏi đáp pháp luật
    # ───────────────────────────────────────────────────────────
    def legal_qa(
        self,
        query              : str,
        extra_instructions : Optional[str] = None,
        legal_top_k        : Optional[int] = None,
        legal_type_filter  : Optional[str] = None,
        call_llm           : bool = True,
    ) -> Dict[str, Any]:
        """
        Hỏi đáp pháp luật hành chính Việt Nam.

        Parameters
        ----------
        query : str
            Câu hỏi pháp luật bằng tiếng Việt.
            VD: "Thẩm quyền ký công văn hành chính theo Nghị định 30/2020 là gì?"
        extra_instructions : str, optional
            Ghi chú bổ sung cho LLM (phạm vi trả lời, ngữ cảnh...).
        legal_top_k : int, optional
            Ghi đè số điều luật retrieve (mặc định dùng self.legal_top_k).
        legal_type_filter : str, optional
            Lọc loại văn bản: "LUẬT" | "NGHỊ ĐỊNH" | "NGHỊ QUYẾT" | "PHÁP LỆNH"
        call_llm : bool
            True  → gọi LLM và trả câu trả lời dạng Markdown.
            False → chỉ build prompt, trả messages thô trong meta["messages"].

        Returns
        -------
        dict:
            Thành công (có LLM):
            {
                "status" : "ok",
                "mode"   : "legal_qa",
                "answer" : str,   ← Markdown string
                "meta"   : {
                    "query"         : str,
                    "elapsed_s"     : float,
                    "legal_sources" : [str, ...],
                    "n_legal_chunks": int,
                }
            }
            Không có LLM / call_llm=False:
            {
                "status" : "prompt_only",
                "mode"   : "legal_qa",
                "answer" : "",
                "meta"   : { ..., "messages": [...] }
            }
            Lỗi:
            {
                "status" : "error",
                "mode"   : "legal_qa",
                "error"  : str,
                "meta"   : { "query": str, "elapsed_s": float }
            }
        """
        t0      = time.time()
        top_k   = legal_top_k if legal_top_k is not None else 5
        try:
            # 1. Retrieve pháp luật
            legal_chunks = retrieve_legal(
                query,
                top_k       = top_k,
                type_filter = legal_type_filter,
                use_reranker= self.use_reranker,
                expand      = True,
            )

            # 2. Build messages
            messages = build_legal_qa_messages(
                query,
                legal_chunks,
                extra_instructions=extra_instructions,
            )

            # 3. Meta
            legal_sources = [
                r["metadata"].get("source_doc_no", r["metadata"].get("id", "?"))
                for r in legal_chunks
            ]
            meta = {
                "query"          : query,
                "elapsed_s"      : round(time.time() - t0, 2),
                "n_legal_chunks" : len(legal_chunks),
                "legal_sources"  : legal_sources,
            }

            # 4. Gọi LLM (nếu bật)
            if not call_llm:
                meta["messages"] = messages
                return {"status": "prompt_only", "mode": "legal_qa", "answer": "", "meta": meta}

            raw = _call_llm(messages)
            if raw is None:
                meta["messages"] = messages
                return {"status": "prompt_only", "mode": "legal_qa", "answer": "", "meta": meta}

            meta["elapsed_s"] = round(time.time() - t0, 2)
            return {
                "status": "ok",
                "mode"  : "legal_qa",
                "answer": raw.strip(),   # Markdown string
                "meta"  : meta,
            }

        except Exception as e:
            logger.exception(f"legal_qa() thất bại: {e}")
            return {
                "status": "error",
                "mode"  : "legal_qa",
                "error" : str(e),
                "meta"  : {"query": query, "elapsed_s": round(time.time() - t0, 2)},
            }

    # ───────────────────────────────────────────────────────────
    # HELPERS
    # ───────────────────────────────────────────────────────────
    def to_json(self, result: Dict[str, Any], indent: int = 2) -> str:
        """Serialize kết quả draft() thành JSON string (bỏ qua messages thô)."""
        safe = {k: v for k, v in result.items() if k != "messages"}
        if "meta" in safe:
            safe["meta"] = {k: v for k, v in safe["meta"].items() if k != "messages"}
        return json.dumps(safe, ensure_ascii=False, indent=indent)

    def to_markdown(self, result: Dict[str, Any]) -> str:
        """
        Chuyển kết quả legal_qa() hoặc draft() thành Markdown có thể render.

        - legal_qa : trả về answer trực tiếp (đã là Markdown).
        - draft    : trả về bảng fields + meta.
        """
        if result.get("mode") == "legal_qa":
            if result["status"] == "ok":
                return result.get("answer", "")
            elif result["status"] == "prompt_only":
                return "_Chưa có câu trả lời — cần cung cấp LLM API key._"
            else:
                return f"**Lỗi:** {result.get('error', 'Không rõ')}"

        # draft mode
        if result["status"] == "error":
            return f"**Lỗi:** {result.get('error', 'Không rõ')}"

        fields = result.get("fields", {})
        meta   = result.get("meta", {})

        lines = [
            f"## Kết quả soạn thảo",
            f"- **Form**: {meta.get('form_id','')} — {meta.get('form_type','')}",
            f"- **Thời gian**: {meta.get('elapsed_s','')}s",
            f"- **Điều luật**: {', '.join(meta.get('legal_sources', []))}",
            "",
            "### Fields",
            "| Field | Giá trị |",
            "|-------|---------|",
        ]
        for k, v in fields.items():
            preview = v[:120].replace("\n", " ") + ("…" if len(v) > 120 else "")
            lines.append(f"| `{k}` | {preview} |")

        return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════
# MODULE-LEVEL SINGLETON (tuỳ chọn)
# ═══════════════════════════════════════════════════════════════
_api_instance: Optional[PromptAPI] = None

def get_api(
    use_reranker   : bool = True,
    legal_top_k    : int  = 2,
    examples_top_k : int  = 1,
) -> PromptAPI:
    """
    Trả về singleton PromptAPI (khởi tạo lần đầu, tái sử dụng các lần sau).
    Phù hợp cho Flask/FastAPI server — gọi get_api() thay vì PromptAPI() mỗi request.

    Example (FastAPI):
        from promptAPI import get_api
        api = get_api()

        @app.post("/draft")
        def draft_endpoint(body: DraftRequest):
            return api.draft(body.query)
    """
    global _api_instance
    if _api_instance is None:
        _api_instance = PromptAPI(
            use_reranker   = use_reranker,
            legal_top_k    = legal_top_k,
            examples_top_k = examples_top_k,
        )
    return _api_instance


# ═══════════════════════════════════════════════════════════════
# CLI SMOKE TEST
# ═══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import argparse, sys

    parser = argparse.ArgumentParser(description="promptAPI smoke test")
    parser.add_argument("--mode",  choices=["draft", "legal_qa"], default="draft")
    parser.add_argument("--query", type=str, default="")
    parser.add_argument("--no-reranker", action="store_true")
    parser.add_argument("--no-llm",      action="store_true",
                        help="Chỉ build prompt, không gọi LLM")
    args = parser.parse_args()

    DEFAULT_QUERIES = {
        "draft"   : "Soạn công văn của Cục Văn thư và Lưu trữ Nhà nước gửi các Bộ về hướng dẫn thi hành Luật Lưu trữ",
        "legal_qa": "Trình bày điều kiện cấp giấy phép kinh doanh?",
    }
    query = args.query or DEFAULT_QUERIES[args.mode]

    print(f"\n{'='*64}")
    print(f"Mode  : {args.mode}")
    print(f"Query : {query}")
    print(f"{'='*64}\n")

    logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")

    api = PromptAPI(use_reranker=not args.no_reranker)

    if args.mode == "draft":
        result = api.draft(query, call_llm=not args.no_llm)
        if result["status"] == "ok":
            print("[OK] Fields trả về:")
            for k, v in result["fields"].items():
                preview = v[:100].replace("\n", " ")
                print(f"  {k}: {preview}")
        elif result["status"] == "prompt_only":
            print("[PROMPT ONLY] Messages đã build:")
            for m in result["meta"].get("messages", []):
                print(f"  [{m['role'].upper()}] {m['content'][:200]}...")
        else:
            print(f"[ERROR] {result['error']}")

        print(f"\nMeta: {json.dumps({k: v for k, v in result['meta'].items() if k != 'messages' and k != 'llm_raw'}, ensure_ascii=False, indent=2)}")

    else:  # legal_qa
        result = api.legal_qa(query, call_llm=not args.no_llm)
        if result["status"] == "ok":
            print("[OK] Câu trả lời:\n")
            print(result["answer"])
        elif result["status"] == "prompt_only":
            print("[PROMPT ONLY] Messages đã build (xem meta['messages'])")
        else:
            print(f"[ERROR] {result['error']}")

        print(f"\nMeta: {json.dumps({k: v for k, v in result['meta'].items() if k != 'messages'}, ensure_ascii=False, indent=2)}")