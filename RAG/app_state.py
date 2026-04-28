"""
app_state.py
============
Tầng shared state trung tâm cho toàn bộ ứng dụng.

Giải quyết vấn đề: main.py (qua PromptAPI → hybrid_retrieval) và updateDB.py
(qua DocumentUpdater) trước đây mỗi bên tự khởi tạo embed model + ChromaDB client
riêng → tốn ~2GB VRAM/RAM thừa và có thể xung đột write trên ChromaDB.

Sau khi dùng app_state.py:
  - Embed model   : 1 instance duy nhất, chia sẻ qua get_embed_model()
  - ChromaDB client: 1 instance duy nhất, chia sẻ qua get_chroma_client()
  - DocumentUpdater: 1 singleton, chia sẻ qua get_updater()

Quy tắc sử dụng:
  1. Luôn gọi init_shared_state() một lần duy nhất (trong startup_event của FastAPI).
  2. Các module khác gọi get_embed_model() / get_chroma_client() / get_updater()
     thay vì tự tạo instance mới.
  3. KHÔNG import trực tiếp _embed_model hay _chroma_client — dùng getter.

Lưu ý về prefix embedding (multilingual-e5-large-instruct):
  - updateDB._embed() dùng "passage: " khi index văn bản vào ChromaDB
    → đúng theo thiết kế E5-instruct cho indexing/encoding.
  - hybrid_retrieval dùng "Instruct: ...\nQuery: " khi encode query
    → đúng theo thiết kế E5-instruct cho retrieval.
  Hai prefix KHÁC NHAU là intentional — không phải bug.
"""

from __future__ import annotations

import logging
import time
from typing import Optional

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

# ── Lấy config từ hybrid_retrieval để không hardcode lại ──────────────────
# Import lazy để tránh circular import; hybrid_retrieval không import app_state.
from hybrid_retrieval import (
    CHROMA_DIR,
    MODEL_EMBED,
    EMBED_MODEL_NAME,
)

# ── Shared singletons ──────────────────────────────────────────────────────
_embed_model:    Optional[SentenceTransformer]  = None
_chroma_client:  Optional[chromadb.PersistentClient] = None
_updater:        Optional["DocumentUpdater"]    = None  # type: ignore[name-defined]

_initialized = False


def init_shared_state(device: Optional[str] = None) -> None:
    """
    Khởi tạo embed model và ChromaDB client dùng chung.
    Gọi một lần duy nhất trong startup_event của FastAPI (hoặc đầu script).

    Parameters
    ----------
    device : str, optional
        "cuda" hoặc "cpu". Mặc định: auto-detect.
    """
    global _embed_model, _chroma_client, _initialized

    if _initialized:
        logger.info("app_state: Đã khởi tạo trước đó — bỏ qua.")
        return

    import torch
    _dev = device or ("cuda" if torch.cuda.is_available() else "cpu")

    logger.info(f"app_state: Khởi tạo embed model trên {_dev}...")
    t0 = time.time()
    _embed_model = SentenceTransformer(
        EMBED_MODEL_NAME,
        device=_dev,
        cache_folder=str(MODEL_EMBED),
        local_files_only=True,
    )
    logger.info(f"app_state: Embed model sẵn sàng sau {time.time()-t0:.1f}s")

    logger.info("app_state: Khởi tạo ChromaDB client...")
    _chroma_client = chromadb.PersistentClient(
        path=str(CHROMA_DIR),
        settings=Settings(anonymized_telemetry=False),
    )
    logger.info("app_state: ChromaDB client sẵn sàng.")

    _initialized = True


def get_embed_model() -> SentenceTransformer:
    """Trả về embed model dùng chung. Raise nếu chưa gọi init_shared_state()."""
    if _embed_model is None:
        raise RuntimeError(
            "Embed model chưa được khởi tạo. Gọi init_shared_state() trước."
        )
    return _embed_model


def get_chroma_client() -> chromadb.PersistentClient:
    """Trả về ChromaDB client dùng chung. Raise nếu chưa gọi init_shared_state()."""
    if _chroma_client is None:
        raise RuntimeError(
            "ChromaDB client chưa được khởi tạo. Gọi init_shared_state() trước."
        )
    return _chroma_client


def get_updater() -> "DocumentUpdater":  # type: ignore[name-defined]
    """
    Trả về singleton DocumentUpdater dùng chung embed model + ChromaDB client
    đã được khởi tạo bởi init_shared_state().
    """
    global _updater
    if _updater is None:
        from updateDB import DocumentUpdater
        _updater = DocumentUpdater(
            _shared_embed_model=get_embed_model(),
            _shared_chroma_client=get_chroma_client(),
        )
    return _updater