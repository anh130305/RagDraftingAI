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
    result = api.draft(
        query  = "Soạn công văn gửi Bộ Tài chính về ngân sách 2025",
        extras = "Ngày ký: 15/01/2025\nNgười ký: Giám đốc Nguyễn Văn A\nSố hiệu: 01/CV-BTC",
    )
    result = api.legal_qa(
        query  = "Thẩm quyền ký công văn theo Nghị định 30/2020 là gì?",
        extras = "Chỉ trích dẫn Nghị định 30/2020, không cần nêu các văn bản khác.",
    )

Tách biệt query vs extras (nhất quán với generatePrompt.py):
  - query  : Yêu cầu chính, mô tả nội dung cần soạn / câu hỏi cần trả lời.
  - extras : Thông tin bổ sung / ràng buộc / metadata (ngày ký, người ký, số hiệu...).
             Được truyền vào build_messages() / build_legal_qa_messages() và lưu vào
             meta["extras"] để debug.

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
from typing import Any, Dict, Iterator, List, Optional

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
    "groq_model"  : os.environ.get("LLM_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct"),
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


def _stream_llm(messages: List[Dict[str, str]]) -> Iterator[str]:
    """
    Stream token từ LLM. Ưu tiên Groq → OpenAI.
    Raise RuntimeError nếu không stream được.
    """
    groq_key = os.environ.get("GROQ_API_KEY", "")
    openai_key = os.environ.get("OPENAI_API_KEY", "")

    if not groq_key and not openai_key:
        raise RuntimeError("Không có LLM API key để stream.")

    # ── Groq ────────────────────────────────────────────────────
    if groq_key:
        try:
            from groq import Groq

            client = Groq(api_key=groq_key)
            stream = client.chat.completions.create(
                model=_LLM_CONFIG["groq_model"],
                messages=messages,
                max_tokens=_LLM_CONFIG["max_tokens"],
                temperature=_LLM_CONFIG["temperature"],
                stream=True,
            )

            emitted_any = False
            for chunk in stream:
                try:
                    token = chunk.choices[0].delta.content
                except Exception:
                    token = None

                if isinstance(token, str) and token:
                    emitted_any = True
                    yield token

            if emitted_any:
                return
        except ImportError:
            logger.warning("groq chưa cài. Chạy: pip install groq")
        except Exception as e:
            logger.error(f"Groq stream lỗi: {e}")

    # ── OpenAI ──────────────────────────────────────────────────
    if openai_key:
        try:
            import openai

            client = openai.OpenAI(api_key=openai_key)
            stream = client.chat.completions.create(
                model=_LLM_CONFIG["openai_model"],
                messages=messages,
                max_tokens=_LLM_CONFIG["max_tokens"],
                temperature=_LLM_CONFIG["temperature"],
                stream=True,
            )

            emitted_any = False
            for chunk in stream:
                try:
                    token = chunk.choices[0].delta.content
                except Exception:
                    token = None

                if isinstance(token, str) and token:
                    emitted_any = True
                    yield token

            if emitted_any:
                return
        except ImportError:
            logger.warning("openai chưa cài. Chạy: pip install openai")
        except Exception as e:
            logger.error(f"OpenAI stream lỗi: {e}")

    raise RuntimeError("Không thể stream phản hồi từ LLM.")


# ═══════════════════════════════════════════════════════════════
# HELPERS NỘI BỘ
# ═══════════════════════════════════════════════════════════════
def _clean_extras(extras: Optional[str]) -> Optional[str]:
    """Trả về extras đã strip, hoặc None nếu rỗng."""
    return extras.strip() if extras and extras.strip() else None

def estimate_tokens(text: str) -> int:
    """
    Ước lượng số token (rule-of-thumb):
    Tiếng Việt dày hơn tiếng Anh — trung bình ~3 chars/token (so với 4 cho English).
    Dùng ÷3.0 để an toàn, tránh underestimate và gặp lỗi 413 từ Groq.
    """
    if not text:
        return 0
    return int(len(text) / 3.0)

# Safe user-input budget:
#   Groq limit: 12,000 tokens total
#   RAG overhead (5 legal chunks + system prompt): ~4,000
#   Response allocation (max_tokens):              ~4,096
#   ──────────────────────────────────────────  ──────
#   Available for user input (query + extras + files):  3,500  (buffer ~400)
USER_TOKEN_LIMIT = 5000
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
        legal_top_k       : int  = 4,
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
        query             : str,
        extras            : Optional[str] = None,
        legal_type_filter : Optional[str] = None,
        call_llm          : bool = True,
    ) -> Dict[str, Any]:
        """
        Soạn thảo văn bản hành chính.

        Parameters
        ----------
        query : str
            Yêu cầu soạn thảo chính bằng tiếng Việt.
            VD: "Soạn công văn của Cục Văn thư gửi các Bộ về hướng dẫn lưu trữ điện tử"
        extras : str, optional
            Thông tin bổ sung / ràng buộc tách biệt với query chính.
            VD: "Ngày ký: 05/01/2025\nNgười ký: Cục trưởng Đặng Thanh Tùng\nSố CV: 12/VTLT-NV"
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
                    "extras"        : str | None,   ← thông tin bổ sung đã dùng
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
                "meta"    : { "query": str, "extras": str | None, "elapsed_s": float }
            }
        """
        t0 = time.time()
        resolved_extras = _clean_extras(extras)

        # Token validation (Limit: 5000)
        total_text = query + (resolved_extras or "")
        total_tokens = estimate_tokens(total_text)
        if total_tokens > USER_TOKEN_LIMIT:
            return {
                "status": "error",
                "mode": "draft",
                "error": f"Tổng đầu vào quá dài (~{total_tokens} tokens). Giới hạn tối đa là {USER_TOKEN_LIMIT} tokens.",
                "meta": {"query": query, "extras": resolved_extras, "elapsed_s": 0}
            }

        try:
            # 1. Retrieve
            retrieved = retrieve_all(
                query,
                legal_top_k       = self.legal_top_k,
                examples_top_k    = self.examples_top_k,
                legal_type_filter = legal_type_filter,
                expand_legal      = True,
            )

            # 2. Build messages (truyền extras đã resolve)
            messages = build_messages(
                query,
                retrieved,
                extra_instructions=resolved_extras,
            )

            # 3. Meta cơ bản
            form_meta   = retrieved["form"][0]["metadata"] if retrieved.get("form") else {}
            legal_sources = [
                r["metadata"].get("source_doc_no", r["metadata"].get("id", "?"))
                for r in retrieved.get("legal", [])
            ]
            meta = {
                "query"         : query,
                "extras"        : resolved_extras,
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
                "meta"  : {"query": query, "extras": resolved_extras, "elapsed_s": round(time.time() - t0, 2)},
            }

    # ───────────────────────────────────────────────────────────
    # LEGAL QA — Hỏi đáp pháp luật
    # ───────────────────────────────────────────────────────────
    def legal_qa(
        self,
        query             : str,
        extras            : Optional[str] = None,
        legal_top_k       : Optional[int] = None,
        legal_type_filter : Optional[str] = None,
        call_llm          : bool = True,
    ) -> Dict[str, Any]:
        """
        Hỏi đáp pháp luật hành chính Việt Nam.

        Parameters
        ----------
        query : str
            Câu hỏi pháp luật chính bằng tiếng Việt.
            VD: "Thẩm quyền ký công văn hành chính theo Nghị định 30/2020 là gì?"
        extras : str, optional
            Ghi chú bổ sung / ràng buộc tách biệt với câu hỏi chính.
            VD: "Chỉ trích dẫn Nghị định 30/2020, không cần nêu các văn bản khác."
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
                    "extras"        : str | None,   ← ghi chú bổ sung đã dùng
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
                "meta"   : { "query": str, "extras": str | None, "elapsed_s": float }
            }
        """
        t0      = time.time()
        top_k   = legal_top_k if legal_top_k is not None else 5
        resolved_extras = _clean_extras(extras)

        # Token validation (Limit: 5000)
        total_text = query + (resolved_extras or "")
        total_tokens = estimate_tokens(total_text)
        if total_tokens > USER_TOKEN_LIMIT:
            return {
                "status": "error",
                "mode": "legal_qa",
                "error": f"Tổng đầu vào quá dài (~{total_tokens} tokens). Giới hạn tối đa là {USER_TOKEN_LIMIT} tokens.",
                "meta": {"query": query, "extras": resolved_extras, "elapsed_s": 0}
            }

        try:
            # 1. Retrieve pháp luật
            legal_chunks = retrieve_legal(
                query,
                top_k       = top_k,
                type_filter = legal_type_filter,
                use_reranker= self.use_reranker,
                expand      = True,
            )

            # 2. Build messages (truyền extras đã resolve)
            messages = build_legal_qa_messages(
                query,
                legal_chunks,
                extra_instructions=resolved_extras,
            )

            # 3. Meta
            legal_sources = [
                r["metadata"].get("source_doc_no", r["metadata"].get("id", "?"))
                for r in legal_chunks
            ]
            meta = {
                "query"          : query,
                "extras"         : resolved_extras,
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
                "meta"  : {"query": query, "extras": resolved_extras, "elapsed_s": round(time.time() - t0, 2)},
            }

    def legal_qa_stream(
        self,
        query: str,
        extras: Optional[str] = None,
        legal_top_k: Optional[int] = None,
        legal_type_filter: Optional[str] = None,
        call_llm: bool = True,
    ) -> Iterator[Dict[str, Any]]:
        """
        Stream kết quả legal_qa theo NDJSON events:
          - {"type": "meta",  "meta": {...}}
          - {"type": "token", "delta": "..."}
          - {"type": "done",  "answer": "...", "meta": {...}}
          - {"type": "error", "error": "...", "meta": {...}}
        """
        t0 = time.time()
        top_k = legal_top_k if legal_top_k is not None else 5
        resolved_extras = _clean_extras(extras)

        total_text = query + (resolved_extras or "")
        total_tokens = estimate_tokens(total_text)
        if total_tokens > USER_TOKEN_LIMIT:
            yield {
                "type": "error",
                "error": f"Tổng đầu vào quá dài (~{total_tokens} tokens). Giới hạn tối đa là {USER_TOKEN_LIMIT} tokens.",
                "meta": {"query": query, "extras": resolved_extras, "elapsed_s": 0},
            }
            return

        try:
            legal_chunks = retrieve_legal(
                query,
                top_k=top_k,
                type_filter=legal_type_filter,
                use_reranker=self.use_reranker,
                expand=True,
            )

            messages = build_legal_qa_messages(
                query,
                legal_chunks,
                extra_instructions=resolved_extras,
            )

            legal_sources = [
                r["metadata"].get("source_doc_no", r["metadata"].get("id", "?"))
                for r in legal_chunks
            ]

            meta: Dict[str, Any] = {
                "query": query,
                "extras": resolved_extras,
                "elapsed_s": round(time.time() - t0, 2),
                "n_legal_chunks": len(legal_chunks),
                "legal_sources": legal_sources,
            }

            yield {"type": "meta", "meta": meta}

            if not call_llm:
                yield {
                    "type": "error",
                    "error": "Streaming yêu cầu call_llm=True và API key hợp lệ.",
                    "meta": meta,
                }
                return

            answer_parts: List[str] = []
            for token in _stream_llm(messages):
                if not token:
                    continue
                answer_parts.append(token)
                yield {"type": "token", "delta": token}

            answer = "".join(answer_parts).strip()
            if not answer:
                yield {
                    "type": "error",
                    "error": "LLM không trả về nội dung.",
                    "meta": meta,
                }
                return

            meta["elapsed_s"] = round(time.time() - t0, 2)
            yield {
                "type": "done",
                "answer": answer,
                "meta": meta,
            }
        except Exception as e:
            logger.exception(f"legal_qa_stream() thất bại: {e}")
            yield {
                "type": "error",
                "error": str(e),
                "meta": {
                    "query": query,
                    "extras": resolved_extras,
                    "elapsed_s": round(time.time() - t0, 2),
                },
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
    legal_top_k    : int  = 4,
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


"""
PATCH cho promptAPI.py — Thay thế toàn bộ block `if __name__ == "__main__":` cũ
bằng phiên bản dưới đây để tích hợp DocxFiller.

Copy đoạn này vào cuối file promptAPI.py (thay thế block cũ).
"""

# ═══════════════════════════════════════════════════════════════
# CLI SMOKE TEST — Tích hợp DocxFiller
# ═══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="promptAPI smoke test")
    parser.add_argument("--mode",   choices=["draft", "legal_qa"], default="draft")
    parser.add_argument("--query",  type=str, default="")
    parser.add_argument("--extras", type=str, default="",
                        help="Thông tin bổ sung tách biệt với query chính")
    parser.add_argument("--no-reranker", action="store_true")
    parser.add_argument("--no-llm",      action="store_true",
                        help="Chỉ build prompt, không gọi LLM")
    parser.add_argument("--no-fill",     action="store_true",
                        help="Bỏ qua bước fill docx, chỉ in fields ra màn hình")
    parser.add_argument("--forms-dir",   type=str, default="Forms/docx",
                        help="Thư mục chứa template docx (mặc định: Forms/docx)")
    parser.add_argument("--drafts-dir",  type=str, default="drafts",
                        help="Thư mục lưu file draft (mặc định: drafts)")
    args = parser.parse_args()

    DEFAULT_QUERIES = {
        "draft"   : "Soạn thảo quyết định về việc bổ nhiệm công chức lãnh đạo, quản lý theo quy định của luật cán bộ, công chức.",
        # "draft": "Soạn thảo biên bản họp Hội đồng kỷ luật công chức.",
        "legal_qa": "Trình bày điều kiện cấp giấy phép kinh doanh?",
    }
    DEFAULT_EXTRAS = {
        "draft"   : (
            "Cơ quan ban hành: Sở Nội vụ tỉnh Bình Dương.\n"
            "Viết tắt cơ quan ban hành: SNV.\n"
            "Cơ quan chủ quản: UBND tỉnh Bình Dương.\n"
            "Số quyết định: 45. Ngày ký: 20/01/2026.\n"
            "Người ký: Giám đốc Sở Nội vụ - Trần Thị Mai.\n"
            "Đối tượng bổ nhiệm: Ông Nguyễn Văn Hùng.\n"
            "Chức vụ bổ nhiệm: Trưởng phòng Hành chính - Tổng hợp.\n"
        ),
        # "draft": (
        #     "Cơ quan ban hành/ chủ quản: Sở Y tế tỉnh Phú Thọ.\n"
        #     "Viết tắt cơ quan ban hành: SYT.\n"
        #     "Đối tượng bị xem xét: Ông Nguyễn Văn Hải, chức vụ Chuyên viên phòng Tổ chức cán bộ.\n"
        #     "Hành vi vi phạm: Vi phạm quy định về thời giờ làm việc, tự ý nghỉ việc không có lý do chính đáng "
        #     "tổng cộng 05 ngày làm việc trong một tháng, gây ảnh hưởng đến tiến độ giải quyết hồ sơ công vụ.\n"
        #     "Thời gian: 14h00 ngày 20/03/2026. Địa điểm: Phòng họp Ban Giám đốc Sở Y tế Phú Thọ.\n"
        #     "Hội đồng kỷ luật: \n"
        #     "1. BS. Nguyễn Đức Thắng (Chủ tịch Hội đồng - Giám đốc Sở)\n"
        #     "2. Bà Trần Thị Lan (Thư ký Hội đồng - Trưởng phòng TC-CB)\n"
        #     "3. Và 03 thành viên khác theo Quyết định số 45/QĐ-SYT ngày 10/03/2026.\n"
        #     "Diễn biến chính: Hội đồng xác định hành vi của ông Hải là tái phạm sau khi đã bị nhắc nhở bằng văn bản. "
        #     "Ông Hải thừa nhận khuyết điểm và hứa sửa chữa. \n"
        #     "Kết quả: Hội đồng tiến hành bỏ phiếu kín. Kết quả 05/05 phiếu (100%) thống nhất kiến nghị hình thức Cảnh cáo."
        # ),
        "legal_qa": "",
    }

    query  = args.query  or DEFAULT_QUERIES[args.mode]
    extras = args.extras or DEFAULT_EXTRAS[args.mode] or None

    print(f"\n{'='*64}")
    print(f"Mode  : {args.mode}")
    print(f"Query : {query}")
    if extras:
        print(f"Extras: {extras}")
    print(f"{'='*64}\n")

    logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")

    api = PromptAPI(use_reranker=not args.no_reranker)

    # ── DRAFT mode ─────────────────────────────────────────────
    if args.mode == "draft":
        result = api.draft(query, extras=extras, call_llm=not args.no_llm)

        if result["status"] == "ok":
            print("[OK] Fields trả về:")
            for k, v in result["fields"].items():
                preview = v[:100].replace("\n", " ")
                print(f"  {k}: {preview}")

            # ── FILL DOCX ──────────────────────────────────────
            if not args.no_fill:
                print("\n" + "-"*48)
                print("Đang fill docx template...")
                try:
                    from docx_filler import DocxFiller
                    filler = DocxFiller(
                        forms_dir  = args.forms_dir,
                        drafts_dir = args.drafts_dir,
                    )
                    output_path = filler.fill_from_result(result)
                    if output_path:
                        print(f"✅ Draft đã lưu tại: {output_path.resolve()}")
                    else:
                        print("⚠️  Không thể fill docx (xem log bên trên).")
                except FileNotFoundError as e:
                    print(f"❌ Không tìm thấy template: {e}")
                except RuntimeError as e:
                    print(f"❌ Lỗi runtime: {e}")
                except Exception as e:
                    print(f"❌ Lỗi không xác định khi fill docx: {e}")
                    logger.exception(e)
            else:
                print("\n[--no-fill] Bỏ qua bước fill docx.")

        elif result["status"] == "prompt_only":
            print("[PROMPT ONLY] Messages đã build (dùng --no-llm để xem chi tiết):")
            for m in result["meta"].get("messages", []):
                print(f"  [{m['role'].upper()}] {m['content'][:200]}...")

        else:
            print(f"[ERROR] {result['error']}")

        print(
            f"\nMeta: {json.dumps({k: v for k, v in result['meta'].items() if k not in ('messages', 'llm_raw')}, ensure_ascii=False, indent=2)}"
        )

    # ── LEGAL QA mode ──────────────────────────────────────────
    else:
        result = api.legal_qa(query, extras=extras, call_llm=not args.no_llm)

        if result["status"] == "ok":
            print("[OK] Câu trả lời:\n")
            print(result["answer"])
        elif result["status"] == "prompt_only":
            print("[PROMPT ONLY] Messages đã build (xem meta['messages'])")
        else:
            print(f"[ERROR] {result['error']}")

        print(
            f"\nMeta: {json.dumps({k: v for k, v in result['meta'].items() if k != 'messages'}, ensure_ascii=False, indent=2)}"
        )