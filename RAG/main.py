import asyncio
import logging
import json
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import time
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="RAG Drafting Service", version="1.0.0")
RAG_SERVICE_MODE = os.getenv("RAG_SERVICE_MODE", "full").strip().lower()

# ─── Global instances (khởi tạo trong startup) ────────────────────────────
_prompt_api = None  # PromptAPI singleton
_updater    = None  # DocumentUpdater singleton (dùng chung resources)
api         = None  # PromptAPI instance dùng cho endpoints
_db_mutation_lock = asyncio.Lock()
_bm25_rebuild_task = None
_bm25_rebuild_state = {
    "running": False,
    "pending": False,
    "started_at": None,
    "finished_at": None,
    "error": None,
    "result": None,
    "runs_completed": 0,
}


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
    global _prompt_api, _updater, api

    logger.info("=" * 60)
    logger.info("RAG Service: Khởi động...")

    # BƯỚC 1: Shared resources (embed model + ChromaDB client)
    from app_state import init_shared_state, get_updater as _get_updater, get_embed_model
    init_shared_state()

    # BƯỚC 2: DocumentUpdater dùng chung model + client
    _updater = _get_updater()

    if RAG_SERVICE_MODE == "full":
        # BƯỚC 3: Inject embed model vào hybrid_retrieval TRƯỚC khi init_retriever chạy.
        # init_retriever() có guard: nếu _embed_model đã có → không load lại từ disk.
        import hybrid_retrieval as hr
        hr._embed_model = get_embed_model()

        # BƯỚC 4: PromptAPI() — __init__ gọi init_retriever() nhưng guard đã đảm bảo
        # model không bị load lần 2. Dùng constructor bình thường, không dùng __new__.
        from promptApi import PromptAPI
        _prompt_api = PromptAPI(
            use_reranker      = True,
            legal_top_k       = 4,
            examples_top_k    = 1,
            force_rebuild_bm25= False,
        )
        api = _prompt_api
    else:
        logger.info(f"RAG Service running in '{RAG_SERVICE_MODE}' mode (PromptAPI disabled).")

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
    legal_type_filter: Optional[str] = None
    call_llm: bool = True

class LegalQARequest(BaseModel):
    query: str
    extras: Optional[str] = None
    legal_top_k: Optional[int] = None
    legal_type_filter: Optional[str] = None
    call_llm: bool = True


class DBCheckRequest(BaseModel):
    so_hieu: str
    collection_key: str = "legal"


class DBIngestRequest(BaseModel):
    ocr_text: str
    ministry: str = ""
    force_if_exists: bool = True
    only_new_chunks: bool = False
    dry_run_delete: bool = False
    skip_upsert: bool = False
    manual_so_hieu: str = ""
    manual_loai_vb: str = ""
    manual_ten_van_ban: str = ""


class DBDeleteDocRequest(BaseModel):
    so_hieu: str
    dry_run: bool = False
    collection_key: str = "legal"


class DBDeleteArticleRequest(BaseModel):
    so_hieu: str
    article_query: str
    dry_run: bool = False
    collection_key: str = "legal"


class DBBatchDeleteRequest(BaseModel):
    so_hieu_list: List[str]
    dry_run: bool = False
    collection_key: str = "legal"


def get_api():
    global api
    if api is None:
        logger.info("Initializing PromptAPI (Lazy Load)...")
        from promptApi import PromptAPI
        api = PromptAPI()
        logger.info("PromptAPI initialized successfully.")
    return api


def _ensure_full_mode() -> None:
    if RAG_SERVICE_MODE != "full":
        raise HTTPException(status_code=404, detail="Endpoint is disabled in rebuild-only mode.")

@app.get("/api/v1/rag/health")
async def health_check():
    if RAG_SERVICE_MODE != "full":
        return {
            "status": "ready",
            "mode": RAG_SERVICE_MODE,
            "message": "RAG rebuild service is operational.",
        }
    if api is None:
        return {"status": "ready_to_load", "message": "Service is up, models not yet loaded."}
    return {"status": "ready", "message": "RAG Service is operational."}


@app.get("/api/v1/db/status")
async def db_status():
    return _get_updater().db_status()


@app.get("/api/v1/db/check/{so_hieu}")
async def db_check_doc(so_hieu: str, collection_key: str = "legal"):
    return _get_updater().check_doc(so_hieu, collection_key=collection_key)


@app.post("/api/v1/db/ingest")
async def db_ingest(request: DBIngestRequest):
    async with _db_mutation_lock:
        return await asyncio.to_thread(
            _get_updater().ingest,
            ocr_text=request.ocr_text,
            ministry=request.ministry,
            force_if_exists=request.force_if_exists,
            only_new_chunks=request.only_new_chunks,
            dry_run_delete=request.dry_run_delete,
            skip_upsert=request.skip_upsert,
            manual_so_hieu=request.manual_so_hieu,
            manual_loai_vb=request.manual_loai_vb,
            manual_ten_van_ban=request.manual_ten_van_ban,
        )


@app.post("/api/v1/db/delete_doc")
async def db_delete_doc(request: DBDeleteDocRequest):
    async with _db_mutation_lock:
        return await asyncio.to_thread(
            _get_updater().delete_doc,
            request.so_hieu,
            dry_run=request.dry_run,
            collection_key=request.collection_key,
        )


@app.post("/api/v1/db/delete_article")
async def db_delete_article(request: DBDeleteArticleRequest):
    async with _db_mutation_lock:
        return await asyncio.to_thread(
            _get_updater().delete_article,
            request.so_hieu,
            request.article_query,
            dry_run=request.dry_run,
            collection_key=request.collection_key,
        )


@app.post("/api/v1/db/batch_delete")
async def db_batch_delete(request: DBBatchDeleteRequest):
    async with _db_mutation_lock:
        result = await asyncio.to_thread(
            _get_updater().batch_delete,
            request.so_hieu_list,
            dry_run=request.dry_run,
            collection_key=request.collection_key,
        )
    return {"items": result.to_dict(orient="records")}


async def _run_bm25_rebuild() -> None:
    global _bm25_rebuild_state, _bm25_rebuild_task
    try:
        while True:
            _bm25_rebuild_state.update({
                "running": True,
                "started_at": time.time(),
                "finished_at": None,
                "error": None,
                "result": None,
            })
            try:
                async with _db_mutation_lock:
                    result = await asyncio.to_thread(_get_updater().rebuild_bm25)
                _bm25_rebuild_state.update({
                    "finished_at": time.time(),
                    "result": result,
                    "runs_completed": _bm25_rebuild_state.get("runs_completed", 0) + 1,
                })
            except Exception as exc:
                logger.exception("BM25 rebuild failed")
                _bm25_rebuild_state.update({
                    "finished_at": time.time(),
                    "error": str(exc),
                })

            if not _bm25_rebuild_state.get("pending"):
                break

            logger.info("BM25 rebuild was requested while running; starting one queued rebuild.")
            _bm25_rebuild_state["pending"] = False
    finally:
        _bm25_rebuild_state.update({
            "running": False,
            "finished_at": time.time(),
        })
        _bm25_rebuild_task = None


def _bm25_rebuild_status() -> Dict[str, Any]:
    state = dict(_bm25_rebuild_state)
    state["status"] = (
        "running" if state.get("running")
        else "queued" if state.get("pending")
        else "failed" if state.get("error")
        else "idle"
    )
    return state


@app.post("/api/v1/db/rebuild_bm25")
async def db_rebuild_bm25():
    global _bm25_rebuild_task

    if _bm25_rebuild_task is None or _bm25_rebuild_task.done():
        _bm25_rebuild_task = asyncio.create_task(_run_bm25_rebuild())
        return {
            "status": "running",
            "message": "BM25 rebuild started in background.",
            "state": _bm25_rebuild_status(),
        }

    _bm25_rebuild_state["pending"] = True
    return {
        "status": "queued",
        "message": "BM25 rebuild is already running; one follow-up rebuild is queued.",
        "state": _bm25_rebuild_status(),
    }


@app.get("/api/v1/db/rebuild_bm25/status")
async def db_rebuild_bm25_status():
    return _bm25_rebuild_status()


@app.post("/api/v1/rag/draft")
async def draft(request: DraftRequest):
    _ensure_full_mode()
    current_api = get_api()
    try:
        result = current_api.draft(
            query=request.query,
            extras=request.extras,
            call_llm=request.call_llm,
        )
        return result
    except Exception as e:
        logger.error(f"Draft error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/rag/legal_qa")
async def legal_qa(request: LegalQARequest):
    _ensure_full_mode()
    current_api = get_api()
    try:
        result = current_api.legal_qa(
            query=request.query,
            extras=request.extras,
            legal_top_k=request.legal_top_k,
            call_llm=request.call_llm,
        )
        return result
    except Exception as e:
        logger.error(f"Legal QA error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/rag/legal_qa_stream")
def legal_qa_stream(request: LegalQARequest):
    _ensure_full_mode()
    current_api = get_api()

    def event_stream():
        try:
            for event in current_api.legal_qa_stream(
                query=request.query,
                extras=request.extras,
                legal_top_k=request.legal_top_k,
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
