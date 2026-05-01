import asyncio
import logging
import json
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import time
import os
from promptApi import PromptAPI

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="RAG Drafting Service", version="1.0.0")

# ─── Global instances (khởi tạo trong startup) ────────────────────────────
_prompt_api = None  # PromptAPI singleton
_updater    = None  # DocumentUpdater singleton (dùng chung resources)


# ═══════════════════════════════════════════════════════════════
# STARTUP / SHUTDOWN
# ═══════════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup_event():
    """
    Thứ tự khởi tạo:
      1. init_shared_state()  → load embed model + ChromaDB client (1 lần duy nhất)
      2. init_retriever()     → build BM25, tạo retrievers (dùng model từ bước 1)
      3. PromptAPI()          → wrap retriever (không load model lại)
      4. get_updater()        → DocumentUpdater nhận inject model + client từ bước 1
    """
    global _prompt_api, _updater

    logger.info("=" * 60)
    logger.info("RAG Service: Khởi động...")

    # BƯỚC 1: Shared resources (embed model + ChromaDB client)
    from app_state import init_shared_state, get_updater as _get_updater
    init_shared_state()

    # BƯỚC 2: Inject embed model vào hybrid_retrieval TRƯỚC khi init_retriever chạy.
    # init_retriever() có guard: nếu _embed_model đã có → không load lại từ disk.
    import hybrid_retrieval as hr
    hr._embed_model = get_embed_model()

    # BƯỚC 3: PromptAPI() — __init__ gọi init_retriever() nhưng guard đã đảm bảo
    # model không bị load lần 2. Dùng constructor bình thường, không dùng __new__.
    from promptApi import PromptAPI
    _prompt_api = PromptAPI(
        use_reranker      = True,
        legal_top_k       = 4,
        examples_top_k    = 1,
        force_rebuild_bm25= False,
    )

    # BƯỚC 4: DocumentUpdater dùng chung model + client
    _updater = _get_updater()

    logger.info("RAG Service: Sẵn sàng xử lý request.")
    logger.info("=" * 60)


def _get_prompt_api():
    global _prompt_api
    if _prompt_api is None:
        logger.info("Lazy-init PromptAPI...")
        from promptApi import PromptAPI
        _prompt_api = PromptAPI()
    return _prompt_api

def _get_updater():
    global _updater
    if _updater is None:
        logger.info("Lazy-init DocumentUpdater...")
        from app_state import get_updater
        _updater = get_updater()
    return _updater


# ═══════════════════════════════════════════════════════════════
# REQUEST MODELS
# ═══════════════════════════════════════════════════════════════

class DraftRequest(BaseModel):
    query: str
    extras: Optional[str] = None
    call_llm: bool = True

class LegalQARequest(BaseModel):
    query: str
    extras: Optional[str] = None
    legal_top_k: Optional[int] = None
    call_llm: bool = True

@app.on_event("startup")
async def startup_event():
    logger.info("RAG Service started. Models will be initialized.")
    global api
    api = PromptAPI()
    logger.info("RAG Service is ready to handle requests.")


def get_api():
    global api
    if api is None:
        logger.info("Initializing PromptAPI (Lazy Load)...")
        api = PromptAPI()
        logger.info("PromptAPI initialized successfully.")
    return api

@app.get("/api/v1/rag/health")
async def health_check():
    if api is None:
        return {"status": "ready_to_load", "message": "Service is up, models not yet loaded."}
    return {"status": "ready", "message": "RAG Service is operational."}

@app.post("/api/v1/rag/draft")
async def draft(request: DraftRequest):
    current_api = get_api()
    try:
        result = current_api.draft(

            query=request.query,
            extras=request.extras,
            legal_type_filter=request.legal_type_filter,
            call_llm=request.call_llm,
        )
        return result
    except Exception as e:
        logger.error(f"Draft error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/rag/legal_qa")
async def legal_qa(request: LegalQARequest):
    current_api = get_api()
    try:
        result = current_api.legal_qa(
            query=request.query,
            extras=request.extras,
            legal_top_k=request.legal_top_k,
            legal_type_filter=request.legal_type_filter,
            call_llm=request.call_llm,
        )
        return result
    except Exception as e:
        logger.error(f"Legal QA error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/rag/legal_qa_stream")
def legal_qa_stream(request: LegalQARequest):
    current_api = get_api()

    def event_stream():
        try:
            for event in current_api.legal_qa_stream(
                query=request.query,
                extras=request.extras,
                legal_top_k=request.legal_top_k,
                legal_type_filter=request.legal_type_filter,
                call_llm=request.call_llm,
            ):
                yield json.dumps(event, ensure_ascii=False) + "\n"
        except (asyncio.CancelledError, GeneratorExit):
            logger.info("Legal QA stream cancelled by client disconnect")
            return
        except Exception as e:
            logger.exception(f"Legal QA stream error: {e}")
            yield json.dumps({"type": "error", "error": str(e)}, ensure_ascii=False) + "\n"

    return StreamingResponse(
        event_stream(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)