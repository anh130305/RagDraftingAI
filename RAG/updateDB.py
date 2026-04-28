"""
updateDB.py
===========
Module production để cập nhật và xoá dữ liệu trong ChromaDB + đồng bộ BM25 index.

Chức năng:
  - ingest()          : Nhận văn bản OCR → tiền xử lý → chunk → upsert vào ChromaDB
  - delete_doc()      : Xoá toàn bộ chunks của một văn bản theo số hiệu
  - delete_article()  : Xoá chunks của một Điều cụ thể
  - batch_delete()    : Xoá hàng loạt nhiều văn bản
  - rebuild_bm25()    : Đồng bộ ChromaDB → Parquet → rebuild BM25 index
  - check_doc()       : Kiểm tra văn bản đã tồn tại trong DB chưa
  - db_status()       : Xem trạng thái tổng quan ChromaDB

Hai tầng ID (phải khớp với preprocessData.ipynb và embedAndIndex.ipynb):
  doc_id    : "{doc_no}__{article_clean}__{content_hash[:10]}"
  chroma_id : SHA256[:24] của f"{doc_id}|{chunk_index}|{text[:200]}"

Usage:
    from updateDB import DocumentUpdater

    updater = DocumentUpdater()

    # Ingest văn bản mới
    report = updater.ingest(
        ocr_text   = raw_text,
        ministry   = "Chính phủ",
        manual_so_hieu = "134/2025/QH15",
    )

    # Xoá văn bản
    updater.delete_doc("110/2004/NĐ-CP")

    # Rebuild BM25 sau khi cập nhật
    updater.rebuild_bm25()
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import time
import unicodedata
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import torch
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

# ============================================================
# CONFIG
# ============================================================
PROJECT_ROOT = Path(".").resolve()
CHUNK_DIR    = PROJECT_ROOT / "dataset" / "chunks"
CHROMA_DIR   = PROJECT_ROOT / "dataset" / "chromadb"
BM25_DIR     = PROJECT_ROOT / "dataset" / "bm25"
MODEL_PATH   = PROJECT_ROOT / "models" / "embedding"

from hybrid_retrieval import EMBED_MODEL_NAME  # dùng chung, không tự định nghĩa lại
EMBED_DEVICE     = "cuda" if torch.cuda.is_available() else "cpu"
EMBED_BATCH_SIZE = 32

COLLECTION_NAMES = {
    "legal"   : "legal_chunks",
    "forms"   : "forms_chunks",
    "examples": "examples_chunks",
}

# Chunking params — phải đồng bộ với chunkData.ipynb
LEGAL_MAX_WORDS     = 400
LEGAL_MIN_WORDS     = 30
LEGAL_OVERLAP_WORDS = 50

# Cột metadata — phải khớp với embedAndIndex.ipynb LEGAL_META_COLS
LEGAL_META_COLS = [
    "doc_id", "source_doc_no", "ministry", "type_normalized",
    "doc_name", "chapter_id", "chapter_name", "article",
    "chunk_index", "total_chunks", "split_type", "word_count",
]

# Export parquet: các cột metadata cần giữ khi sync từ ChromaDB
PARQUET_META_COLS = LEGAL_META_COLS  # giống nhau

# Văn bản không được xoá tự động
NEVER_REMOVE = {
    "30/2020/NĐ-CP", "01/2011/QH13", "80/2015/QH13", "15/2020/QH14",
    "34/2016/NĐ-CP", "45/2019/QH14", "58/2014/QH13", "22/2008/QH12",
    "58/2010/QH12", "138/2020/NĐ-CP", "115/2020/NĐ-CP", "61/2018/NĐ-CP",
    "34/2019/NĐ-CP", "76/2015/QH13", "77/2015/QH13", "36/2018/QH14",
    "02/2011/QH13", "03/2011/QH13",
}

# Patterns nhận diện văn bản bị bãi bỏ
OBSOLETE_PATTERNS = [
    re.compile(r'bãi bỏ\s+(?:[^,;.\n]*?\s+)?số\s+([\d/a-zA-ZĐÔƯĂ\-]+)',         re.IGNORECASE | re.UNICODE),
    re.compile(r'thay thế\s+(?:[^,;.\n]*?\s+)?số\s+([\d/a-zA-ZĐÔƯĂ\-]+)',        re.IGNORECASE | re.UNICODE),
    re.compile(r'hết hiệu lực\s+(?:[^,;.\n]*?\s+)?số\s+([\d/a-zA-ZĐÔƯĂ\-]+)',    re.IGNORECASE | re.UNICODE),
    re.compile(r'(?:hủy bỏ|đình chỉ thi hành)\s+(?:[^,;.\n]*?\s+)?số\s+([\d/a-zA-ZĐÔƯĂ\-]+)', re.IGNORECASE | re.UNICODE),
    re.compile(r'không còn hiệu lực\s+(?:[^,;.\n]*?\s+)?số\s+([\d/a-zA-ZĐÔƯĂ\-]+)', re.IGNORECASE | re.UNICODE),
]

ARTICLE_PATTERN = re.compile(
    r'(?:^|\n)\s*(Điều\s+\d+[a-z]?\.?(?:\s+[^\n]+)?)',
    re.MULTILINE | re.UNICODE,
)
CHAPTER_PATTERN = re.compile(
    r'(?:^|\n)\s*(Chương\s+[IVXLCDM]+\.?(?:\s+[^\n]+)?)',
    re.MULTILINE | re.UNICODE,
)
CLAUSE_PATTERN = re.compile(
    r'(?:^|\n)'
    r'(\d{1,2}\. '
    r'|[a-zđ]\) '
    r'|[àáảãạăắặằẳẵâấậầẩẫ]\) '
    r'|- (?=\S)'
    r')',
    re.MULTILINE | re.UNICODE,
)


# ============================================================
# UTILITY FUNCTIONS
# ============================================================

def _normalize_doc_no(s: str) -> str:
    return s.strip().upper().replace(" ", "")


def _normalize_text(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = text.replace("\t", " ").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[^\S\n]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _count_words(text: str) -> int:
    return len(text.split()) if isinstance(text, str) else 0


def _make_doc_id(so_hieu: str, article: str, content: str) -> str:
    """
    Tái tạo doc_id khớp với preprocessData.ipynb → make_legal_doc_id().
    Format: "{doc_no}__{article_clean}__{content_hash[:10]}"
    """
    content_hash  = hashlib.sha256(content.encode("utf-8")).hexdigest()[:10]
    doc_no        = str(so_hieu or "").strip()
    article_clean = str(article  or "").strip()
    doc_no_valid  = bool(doc_no)        and doc_no.lower()        != "nan"
    art_valid     = bool(article_clean) and article_clean.lower() != "nan"

    if doc_no_valid and art_valid:
        base = f"{doc_no}__{article_clean[:80]}"
    elif doc_no_valid:
        base = doc_no
    else:
        return f"sha_{content_hash}"

    base_clean = re.sub(r"[^\w/\-.]+", "_", base)
    return f"{base_clean}__{content_hash}"


def _make_chroma_id(doc_id: str, chunk_index: int, text: str) -> str:
    """
    Tái tạo ChromaDB chunk ID khớp với embedAndIndex.ipynb.
    Format: SHA256[:24] của f"{doc_id}|{chunk_index}|{text[:200]}"
    """
    raw = f"{doc_id}|{chunk_index}|{str(text)[:200]}"
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


def _coerce_metadata(meta: Dict) -> Dict:
    """Chuyển metadata về kiểu ChromaDB-compatible."""
    clean: Dict = {}
    for k, v in meta.items():
        if v is None:
            continue
        if isinstance(v, (np.integer,)):
            clean[k] = int(v)
        elif isinstance(v, (np.floating,)):
            clean[k] = float(v)
        elif isinstance(v, (np.bool_,)):
            clean[k] = bool(v)
        elif isinstance(v, (list, dict)):
            clean[k] = json.dumps(v, ensure_ascii=False)
        elif isinstance(v, (str, int, float, bool)):
            clean[k] = v
        else:
            clean[k] = str(v)
    return clean


# ============================================================
# PARSING
# ============================================================

def _extract_doc_header(text: str) -> Dict[str, str]:
    """Trích metadata từ phần header văn bản OCR."""
    header = {"so_hieu": "", "ten_van_ban": "", "co_quan": "", "loai_vb": "KHÔNG RÕ"}
    lines  = text[:2000].split("\n")

    so_hieu_pat = re.compile(
        r'\b(\d{1,3}/\d{4}/(?:[A-ZĐÔƯĂƠ][A-ZĐÔƯĂƠ0-9\-]+(?:/[A-ZĐÔƯĂƠ0-9\-]+)*))',
        re.UNICODE,
    )
    for line in lines:
        m = so_hieu_pat.search(line)
        if m:
            header["so_hieu"] = m.group(1)
            break

    for pat, loai in [
        (r'LUẬT', 'LUẬT'), (r'NGHỊ ĐỊNH', 'NGHỊ ĐỊNH'),
        (r'NGHỊ QUYẾT', 'NGHỊ QUYẾT'), (r'THÔNG TƯ', 'THÔNG TƯ'),
        (r'QUYẾT ĐỊNH', 'QUYẾT ĐỊNH'), (r'PHÁP LỆNH', 'PHÁP LỆNH'),
    ]:
        if re.search(pat, text[:500], re.IGNORECASE):
            header["loai_vb"] = loai
            break

    for line in lines[:30]:
        line_clean = line.strip()
        if len(line_clean) > 20 and re.search(
            r'[VỀ|QUY ĐỊNH|HƯỚNG DẪN|BAN HÀNH]', line_clean, re.IGNORECASE
        ):
            header["ten_van_ban"] = line_clean[:200]
            break

    return header


def _split_articles(text: str) -> List[Dict[str, str]]:
    """Tách văn bản OCR thành danh sách các Điều."""
    parts = ARTICLE_PATTERN.split(text)
    if len(parts) <= 1:
        return [{"article": "Toàn văn", "content": text.strip(),
                 "chapter_id": "", "chapter_name": ""}]

    articles = []
    current_chapter_id, current_chapter_name = "", ""

    m = CHAPTER_PATTERN.search(parts[0])
    if m:
        chap_text = m.group(1).strip()
        chap_num  = re.search(r'[IVXLCDM]+', chap_text)
        current_chapter_id   = chap_num.group(0) if chap_num else ""
        current_chapter_name = chap_text

    i = 1
    while i < len(parts) - 1:
        article_header = parts[i].strip()
        raw_content    = parts[i + 1]

        chapter_m = CHAPTER_PATTERN.search(raw_content)
        if chapter_m:
            chap_text = chapter_m.group(1).strip()
            chap_num  = re.search(r'[IVXLCDM]+', chap_text)
            current_chapter_id   = chap_num.group(0) if chap_num else ""
            current_chapter_name = chap_text
            raw_content = raw_content[:chapter_m.start()] + raw_content[chapter_m.end():]

        content = _normalize_text(raw_content)
        if content:
            articles.append({
                "article"     : article_header,
                "content"     : content,
                "chapter_id"  : current_chapter_id,
                "chapter_name": current_chapter_name,
            })
        i += 2

    return articles


def _split_into_clauses(text: str) -> List[Tuple[str, str]]:
    parts = CLAUSE_PATTERN.split(text)
    if len(parts) <= 1:
        return [(text.strip(), "no_clause")]
    result = []
    pre = parts[0].strip()
    if pre:
        result.append((pre, "preamble"))
    i = 1
    while i < len(parts) - 1:
        label       = parts[i].strip()
        content     = parts[i + 1]
        clause_text = (label + " " + content).strip()
        if clause_text:
            ctype = "numbered" if re.match(r'\d', label) else ("bullet" if label.startswith("-") else "lettered")
            result.append((clause_text, ctype))
        i += 2
    return result if result else [(text.strip(), "no_clause")]


def _fixed_word_split(text: str, max_words: int, overlap_words: int) -> List[str]:
    words  = text.split()
    chunks = []
    start  = 0
    while start < len(words):
        end = min(start + max_words, len(words))
        chunks.append(" ".join(words[start:end]))
        if end == len(words):
            break
        start = end - overlap_words
    return chunks


def _chunk_article(
    article_dict: Dict,
    so_hieu: str,
    loai_vb: str,
    ten_vb: str,
    ministry: str = "",
) -> List[Dict]:
    """
    Chunking 1 Điều → list chunk dicts.
    Đồng bộ hoàn toàn với chunkData.ipynb (chunk_legal_row).
    """
    article      = article_dict["article"]
    content      = article_dict["content"]
    chapter_id   = article_dict.get("chapter_id", "")
    chapter_name = article_dict.get("chapter_name", "")
    doc_id       = _make_doc_id(so_hieu, article, content)

    meta_base = {
        "doc_id"         : doc_id,
        "source_doc_no"  : so_hieu,
        "ministry"       : ministry,
        "type_normalized": loai_vb,
        "doc_name"       : ten_vb,
        "chapter_id"     : chapter_id,
        "chapter_name"   : chapter_name,
        "article"        : article,
    }

    # CASE 1: Điều ngắn → 1 chunk
    if _count_words(content) <= LEGAL_MAX_WORDS:
        text = f"{article}\n{content}" if article else content
        return [{
            **meta_base,
            "chunk_index" : 0,
            "total_chunks": 1,
            "split_type"  : "article",
            "text"        : text,
            "word_count"  : _count_words(text),
        }]

    # CASE 2: Điều dài → split theo khoản
    clauses      = _split_into_clauses(content)
    raw_segments: List[Tuple[str, str]] = []

    if len(clauses) == 1 and clauses[0][1] == "no_clause":
        for seg in _fixed_word_split(content, LEGAL_MAX_WORDS, LEGAL_OVERLAP_WORDS):
            raw_segments.append((seg, "fixed_word"))
    else:
        for clause_text, clause_type in clauses:
            if _count_words(clause_text) <= LEGAL_MAX_WORDS:
                stype = "clause" if clause_type != "preamble" else "preamble"
                raw_segments.append((clause_text, stype))
            else:
                for seg in _fixed_word_split(clause_text, LEGAL_MAX_WORDS, LEGAL_OVERLAP_WORDS):
                    raw_segments.append((seg, "fixed_word"))

    # Merge chunks quá ngắn
    merged: List[Tuple[str, str]] = []
    buf_text, buf_type = "", ""
    for seg_text, seg_type in raw_segments:
        seg_text = seg_text.strip()
        if not seg_text:
            continue
        if buf_text and _count_words(buf_text) < LEGAL_MIN_WORDS:
            buf_text = buf_text + "\n" + seg_text
        else:
            if buf_text:
                merged.append((buf_text, buf_type))
            buf_text, buf_type = seg_text, seg_type
    if buf_text.strip():
        merged.append((buf_text.strip(), buf_type))

    article_header = f"[{article}]" if article else ""
    total   = len(merged)
    results = []
    for idx, (seg_text, seg_type) in enumerate(merged):
        text = f"{article_header}\n{seg_text}" if total > 1 and article_header else seg_text
        results.append({
            **meta_base,
            "chunk_index" : idx,
            "total_chunks": total,
            "split_type"  : seg_type,
            "text"        : text,
            "word_count"  : _count_words(text),
        })
    return results


def _detect_abolished_docs(full_text: str) -> List[Dict]:
    """Quét văn bản tìm số hiệu bị bãi bỏ. Loại trừ NEVER_REMOVE."""
    never_remove_norm = {_normalize_doc_no(x) for x in NEVER_REMOVE}
    found: Dict[str, Dict] = {}
    for pat in OBSOLETE_PATTERNS:
        for m in pat.finditer(full_text):
            so_hieu = _normalize_doc_no(m.group(1))
            if not so_hieu or len(so_hieu) < 5 or so_hieu in never_remove_norm:
                continue
            snippet = full_text[max(0, m.start()-30):m.end()+60].replace("\n", " ")
            if so_hieu not in found:
                found[so_hieu] = {"count": 0, "snippets": [], "pattern": pat.pattern[:50]}
            found[so_hieu]["count"] += 1
            found[so_hieu]["snippets"].append(snippet)

    return [
        {"so_hieu": k, "count": v["count"],
         "snippet": v["snippets"][0][:150], "pattern": v["pattern"]}
        for k, v in found.items()
    ]


# ============================================================
# DOCUMENT UPDATER CLASS
# ============================================================

class DocumentUpdater:
    """
    Class chính để cập nhật và xoá dữ liệu ChromaDB.

    Parameters
    ----------
    embed_model_name : str
        Tên embedding model (mặc định: intfloat/multilingual-e5-large-instruct)
    device : str, optional
        "cuda" hoặc "cpu". Mặc định: auto-detect.
    batch_size : int
        Số chunks mỗi lần embed + upsert. Mặc định: 32.

    Usage:
        updater = DocumentUpdater()

        # Ingest
        report = updater.ingest(ocr_text=raw_text, manual_so_hieu="134/2025/QH15")

        # Xoá
        updater.delete_doc("110/2004/NĐ-CP")

        # Sync + Rebuild BM25
        updater.rebuild_bm25()
    """

    def __init__(
        self,
        embed_model_name: str = EMBED_MODEL_NAME,
        device: Optional[str] = None,
        batch_size: int = EMBED_BATCH_SIZE,
        # ── Dependency injection: dùng chung instance từ app_state ──────────
        # Khi chạy trong FastAPI server, truyền vào để tránh load model 2 lần.
        # Khi chạy standalone (notebook / CLI), để None → tự khởi tạo.
        _shared_embed_model: Optional[SentenceTransformer] = None,
        _shared_chroma_client: Optional[chromadb.PersistentClient] = None,
    ):
        self._device     = device or EMBED_DEVICE
        self._batch_size = batch_size

        # ── ChromaDB client ───────────────────────────────────────────────
        if _shared_chroma_client is not None:
            self._chroma_client = _shared_chroma_client
            logger.info("DocumentUpdater: Dùng ChromaDB client dùng chung (shared).")
        else:
            logger.info("DocumentUpdater: Khởi tạo ChromaDB client riêng...")
            self._chroma_client = chromadb.PersistentClient(
                path=str(CHROMA_DIR),
                settings=Settings(anonymized_telemetry=False),
            )
            logger.info("DocumentUpdater: ChromaDB sẵn sàng.")

        # ── Embed model ───────────────────────────────────────────────────
        if _shared_embed_model is not None:
            self._embed_model = _shared_embed_model
            logger.info("DocumentUpdater: Dùng embed model dùng chung (shared).")
        else:
            logger.info(f"DocumentUpdater: Load embedding model ({self._device})...")
            t0 = time.time()
            self._embed_model = SentenceTransformer(
                embed_model_name,
                device=self._device,
                cache_folder=str(MODEL_PATH),
            )
            logger.info(f"DocumentUpdater: Model loaded in {time.time()-t0:.1f}s")

    # ─────────────────────────────────────────────────────────
    # INTERNAL HELPERS
    # ─────────────────────────────────────────────────────────

    def _get_collection(self, key: str) -> chromadb.Collection:
        return self._chroma_client.get_collection(name=COLLECTION_NAMES[key])

    def _embed(self, texts: List[str]) -> np.ndarray:
        prefixed = [f"passage: {t}" for t in texts]
        return self._embed_model.encode(
            prefixed,
            batch_size=self._batch_size,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=len(texts) > 10,
        )

    # ─────────────────────────────────────────────────────────
    # PUBLIC: STATUS
    # ─────────────────────────────────────────────────────────

    def db_status(self) -> Dict[str, int]:
        """Trả về số chunks hiện có của từng collection."""
        status = {}
        for key, col_name in COLLECTION_NAMES.items():
            try:
                col = self._get_collection(key)
                status[col_name] = col.count()
                logger.info(f"  {col_name}: {col.count():,} chunks")
            except Exception as e:
                status[col_name] = -1
                logger.warning(f"  {col_name}: ❌ {e}")
        return status

    # ─────────────────────────────────────────────────────────
    # PUBLIC: CHECK
    # ─────────────────────────────────────────────────────────

    def check_doc(
        self,
        so_hieu: str,
        collection_key: str = "legal",
    ) -> Dict:
        """
        Kiểm tra văn bản đã tồn tại trong DB chưa.

        Returns
        -------
        {
            "exists"        : bool,
            "chunk_count"   : int,
            "article_count" : int,
            "articles"      : list[str],   # tối đa 10
            "so_hieu"       : str,
        }
        """
        col     = self._get_collection(collection_key)
        results = col.get(where={"source_doc_no": {"$eq": so_hieu}}, include=["metadatas"])
        chunk_count   = len(results["ids"])
        articles_seen = list(dict.fromkeys(
            m.get("article", "") for m in results["metadatas"]
        ))
        return {
            "exists"       : chunk_count > 0,
            "chunk_count"  : chunk_count,
            "article_count": len(articles_seen),
            "articles"     : articles_seen[:10],
            "so_hieu"      : so_hieu,
        }

    def check_docs_batch(
        self,
        so_hieu_list: List[str],
        collection_key: str = "legal",
    ) -> pd.DataFrame:
        """Kiểm tra hàng loạt nhiều văn bản, trả về DataFrame tóm tắt."""
        rows = []
        for so_hieu in so_hieu_list:
            info = self.check_doc(so_hieu, collection_key)
            rows.append({
                "so_hieu"       : so_hieu,
                "exists"        : info["exists"],
                "chunks_in_db"  : info["chunk_count"],
                "articles_in_db": info["article_count"],
                "status"        : "Đã có" if info["exists"] else "Chưa có",
            })
        return pd.DataFrame(rows)

    # ─────────────────────────────────────────────────────────
    # PUBLIC: DELETE
    # ─────────────────────────────────────────────────────────

    def delete_doc(
        self,
        so_hieu: str,
        dry_run: bool = False,
        collection_key: str = "legal",
    ) -> Dict:
        """
        Xoá tất cả chunks thuộc văn bản có số hiệu `so_hieu`.

        Parameters
        ----------
        so_hieu : str
            Số hiệu văn bản cần xoá, VD: "110/2004/NĐ-CP"
        dry_run : bool
            True = chỉ xem trước, không xoá thật. Mặc định: False.
        collection_key : str
            "legal" | "forms" | "examples". Mặc định: "legal".

        Returns
        -------
        {"so_hieu", "found_ids", "deleted_count", "dry_run", "protected"}
        """
        if _normalize_doc_no(so_hieu) in {_normalize_doc_no(x) for x in NEVER_REMOVE}:
            logger.warning(f"delete_doc: '{so_hieu}' nằm trong NEVER_REMOVE — bỏ qua.")
            return {"so_hieu": so_hieu, "found_ids": [], "deleted_count": 0,
                    "dry_run": dry_run, "protected": True}

        col     = self._get_collection(collection_key)
        results = col.get(where={"source_doc_no": {"$eq": so_hieu}}, include=["metadatas"])
        found_ids = results["ids"]

        logger.info(f"delete_doc: '{so_hieu}' → {len(found_ids)} chunks tìm thấy")

        if not found_ids:
            return {"so_hieu": so_hieu, "found_ids": [], "deleted_count": 0,
                    "dry_run": dry_run, "protected": False}

        if dry_run:
            logger.info(f"delete_doc [DRY RUN]: sẽ xoá {len(found_ids)} chunks.")
            return {"so_hieu": so_hieu, "found_ids": found_ids, "deleted_count": 0,
                    "dry_run": True, "protected": False}

        deleted = 0
        for i in range(0, len(found_ids), 100):
            col.delete(ids=found_ids[i:i+100])
            deleted += len(found_ids[i:i+100])

        logger.info(f"delete_doc: Đã xoá {deleted} chunks của '{so_hieu}'.")
        logger.warning("BM25 chưa cập nhật — gọi rebuild_bm25() nếu cần.")
        return {"so_hieu": so_hieu, "found_ids": found_ids, "deleted_count": deleted,
                "dry_run": False, "protected": False}

    def delete_article(
        self,
        so_hieu: str,
        article_query: str,
        dry_run: bool = False,
        collection_key: str = "legal",
    ) -> Dict:
        """
        Xoá chunks thuộc một Điều cụ thể của văn bản.

        Parameters
        ----------
        so_hieu       : Số hiệu văn bản.
        article_query : Tên hoặc số Điều, VD: "Điều 5".
        dry_run       : True = chỉ xem trước. Mặc định: False.

        Returns
        -------
        {"found_ids", "deleted_count", "dry_run"}
        """
        col     = self._get_collection(collection_key)
        results = col.get(where={"source_doc_no": {"$eq": so_hieu}}, include=["metadatas"])
        if not results["ids"]:
            logger.warning(f"delete_article: '{so_hieu}' không tìm thấy trong DB.")
            return {"found_ids": [], "deleted_count": 0, "dry_run": dry_run}

        try:
            article_pattern = re.compile(
                r'(?<![\d\w])' + re.escape(article_query.strip()) + r'(?![\d\w])',
                re.IGNORECASE | re.UNICODE,
            )
        except re.error:
            article_pattern = re.compile(re.escape(article_query.strip()), re.IGNORECASE | re.UNICODE)

        matched_ids = [
            cid for cid, meta in zip(results["ids"], results["metadatas"])
            if article_pattern.search(meta.get("article", ""))
        ]

        logger.info(f"delete_article: '{article_query}' trong '{so_hieu}' → {len(matched_ids)} chunks")

        if not matched_ids or dry_run:
            return {"found_ids": matched_ids, "deleted_count": 0, "dry_run": dry_run}

        col.delete(ids=matched_ids)
        logger.info(f"delete_article: Đã xoá {len(matched_ids)} chunks.")
        return {"found_ids": matched_ids, "deleted_count": len(matched_ids), "dry_run": False}

    def batch_delete(
        self,
        so_hieu_list: List[str],
        dry_run: bool = False,
        collection_key: str = "legal",
    ) -> pd.DataFrame:
        """
        Xoá nhiều văn bản từ danh sách số hiệu.

        Returns
        -------
        DataFrame tóm tắt: so_hieu, found_chunks, deleted, protected
        """
        rows = []
        for so_hieu in so_hieu_list:
            res = self.delete_doc(so_hieu, dry_run=dry_run, collection_key=collection_key)
            rows.append({
                "so_hieu"     : so_hieu,
                "found_chunks": len(res["found_ids"]),
                "deleted"     : res["deleted_count"],
                "protected"   : res.get("protected", False),
            })
        return pd.DataFrame(rows)

    # ─────────────────────────────────────────────────────────
    # PUBLIC: UPSERT
    # ─────────────────────────────────────────────────────────

    def _upsert_chunks(
        self,
        chunks: List[Dict],
        collection_key: str = "legal",
        only_new: bool = False,
    ) -> Dict:
        """
        Embed và upsert list chunks vào ChromaDB.

        Parameters
        ----------
        chunks         : list dict từ _chunk_article()
        collection_key : "legal" | "forms" | "examples"
        only_new       : True → chỉ upsert chunks chưa có (không overwrite)

        Returns
        -------
        {"upserted", "skipped", "errors"}
        """
        col = self._get_collection(collection_key)

        # Optional: filter chỉ upsert chunks thực sự mới
        skipped = 0
        if only_new:
            id_map = {
                _make_chroma_id(c["doc_id"], c["chunk_index"], c["text"]): c
                for c in chunks
            }
            try:
                existing = col.get(ids=list(id_map.keys()), include=[])
                existing_ids = set(existing["ids"])
            except Exception:
                existing_ids = set()
            chunks   = [c for cid, c in id_map.items() if cid not in existing_ids]
            skipped  = len(existing_ids)
            logger.info(f"_upsert_chunks: only_new=True → {len(chunks)} mới, skip {skipped}")

        if not chunks:
            return {"upserted": 0, "skipped": skipped, "errors": []}

        upserted = 0
        errors   = []

        for i in range(0, len(chunks), self._batch_size):
            batch = chunks[i:i+self._batch_size]
            texts = [c["text"] for c in batch]

            try:
                embeddings = self._embed(texts)
            except Exception as e:
                errors.append(f"Embed batch {i}: {e}")
                continue

            ids       = [_make_chroma_id(c["doc_id"], c["chunk_index"], c["text"]) for c in batch]
            metadatas = [_coerce_metadata({k: c.get(k) for k in LEGAL_META_COLS}) for c in batch]

            try:
                col.upsert(ids=ids, embeddings=embeddings.tolist(),
                           documents=texts, metadatas=metadatas)
                upserted += len(batch)
                logger.info(f"  Batch {i//self._batch_size + 1}: upserted {len(batch)} chunks")
            except Exception as e:
                errors.append(f"Upsert batch {i}: {e}")

        if not errors and upserted > 0:
            logger.warning("BM25 chưa cập nhật — gọi rebuild_bm25() nếu cần.")

        return {"upserted": upserted, "skipped": skipped, "errors": errors}

    # ─────────────────────────────────────────────────────────
    # PUBLIC: INGEST
    # ─────────────────────────────────────────────────────────

    def ingest(
        self,
        ocr_text: str,
        ministry: str = "",
        collection_key: str = "legal",
        force_if_exists: bool = True,
        only_new_chunks: bool = False,
        dry_run_delete: bool = False,
        skip_upsert: bool = False,
        manual_so_hieu: str = "",
        manual_loai_vb: str = "",
        manual_ten_van_ban: str = "",
    ) -> Dict:
        """
        Pipeline đầy đủ xử lý văn bản OCR mới: parse → chunk → upsert → xoá bãi bỏ.

        Parameters
        ----------
        ocr_text           : Văn bản OCR thô dạng string.
        ministry           : Cơ quan ban hành, VD: "Chính phủ".
        collection_key     : "legal" | "forms" | "examples". Mặc định: "legal".
        force_if_exists    : False → dừng nếu văn bản đã có trong DB.
        only_new_chunks    : True → chỉ embed/upsert chunks chưa tồn tại.
        dry_run_delete     : True → không thực sự xoá văn bản bãi bỏ.
        skip_upsert        : True → chỉ parse, không upsert (để xem trước).
        manual_so_hieu     : Ghi đè số hiệu auto-detect.
        manual_loai_vb     : Ghi đè loại văn bản auto-detect.
        manual_ten_van_ban : Ghi đè tên văn bản auto-detect.

        Returns
        -------
        {
            "status"            : "ok" | "error" | "skipped",
            "header"            : dict,
            "doc_already_exists": bool,
            "articles_found"    : int,
            "chunks_created"    : int,
            "abolished_found"   : list,
            "delete_results"    : list,
            "upsert_result"     : dict,
            "errors"            : list,
        }
        """
        report = {
            "status"            : "error",
            "header"            : {},
            "doc_already_exists": False,
            "articles_found"    : 0,
            "chunks_created"    : 0,
            "abolished_found"   : [],
            "delete_results"    : [],
            "upsert_result"     : {},
            "errors"            : [],
        }

        logger.info("=" * 60)
        logger.info("ingest: Bắt đầu xử lý văn bản OCR")

        # BƯỚC 1: Trích header
        header = _extract_doc_header(ocr_text)
        if manual_so_hieu:    header["so_hieu"]    = manual_so_hieu
        if manual_loai_vb:    header["loai_vb"]    = manual_loai_vb
        if manual_ten_van_ban: header["ten_van_ban"] = manual_ten_van_ban
        report["header"] = header

        logger.info(f"ingest: so_hieu={header['so_hieu']} loai={header['loai_vb']}")

        if not header["so_hieu"]:
            msg = "Không nhận diện được số hiệu — truyền manual_so_hieu."
            report["errors"].append(msg)
            logger.error(f"ingest: {msg}")
            return report

        # BƯỚC 2: Kiểm tra tồn tại
        exists_info = self.check_doc(header["so_hieu"], collection_key)
        report["doc_already_exists"] = exists_info["exists"]

        if exists_info["exists"]:
            logger.warning(
                f"ingest: '{header['so_hieu']}' đã có {exists_info['chunk_count']} chunks trong DB."
            )
            if not force_if_exists:
                msg = (f"'{header['so_hieu']}' đã tồn tại. "
                       "Đặt force_if_exists=True để upsert đè.")
                report["errors"].append(msg)
                report["status"] = "skipped"
                return report

        # BƯỚC 3: Tách Điều
        articles = _split_articles(ocr_text)
        report["articles_found"] = len(articles)
        logger.info(f"ingest: {len(articles)} Điều")

        if not articles:
            report["errors"].append("Không tìm thấy Điều nào trong văn bản.")
            return report

        # BƯỚC 4: Chunking
        all_chunks = []
        for art in articles:
            all_chunks.extend(_chunk_article(
                art,
                so_hieu  = header["so_hieu"],
                loai_vb  = header["loai_vb"],
                ten_vb   = header["ten_van_ban"],
                ministry = ministry,
            ))
        report["chunks_created"] = len(all_chunks)
        if all_chunks:
            wc = [c["word_count"] for c in all_chunks]
            logger.info(
                f"ingest: {len(all_chunks)} chunks | "
                f"min={min(wc)} max={max(wc)} mean={sum(wc)//len(wc)} từ"
            )

        # BƯỚC 5: Detect bãi bỏ
        abolished = _detect_abolished_docs(ocr_text)
        report["abolished_found"] = abolished
        if abolished:
            logger.warning(f"ingest: {len(abolished)} văn bản bị bãi bỏ: "
                           f"{[x['so_hieu'] for x in abolished]}")

        # BƯỚC 6: Upsert (TRƯỚC khi xoá)
        if skip_upsert:
            logger.info("ingest: skip_upsert=True — bỏ qua upsert.")
        else:
            logger.info(f"ingest: Upsert {len(all_chunks)} chunks...")
            upsert_result = self._upsert_chunks(
                all_chunks, collection_key=collection_key, only_new=only_new_chunks
            )
            report["upsert_result"] = upsert_result
            if upsert_result["errors"]:
                report["errors"].extend(upsert_result["errors"])
                logger.error(f"ingest: Lỗi upsert — dừng, không xoá bãi bỏ.")
                return report

        # BƯỚC 7: Xoá văn bản bãi bỏ (SAU khi upsert thành công)
        if abolished:
            for item in abolished:
                del_res = self.delete_doc(
                    item["so_hieu"], dry_run=dry_run_delete,
                    collection_key=collection_key,
                )
                report["delete_results"].append(del_res)

        report["status"] = "ok"
        upserted = report.get("upsert_result", {}).get("upserted", 0)
        deleted  = sum(r.get("deleted_count", 0) for r in report["delete_results"])
        logger.info(
            f"ingest: Hoàn tất — upsert={upserted} chunks | delete={deleted} chunks"
        )
        if upserted > 0 or deleted > 0:
            logger.warning("BM25 chưa cập nhật — gọi rebuild_bm25() sau khi xong.")

        return report

    # ─────────────────────────────────────────────────────────
    # PUBLIC: REBUILD BM25
    # ─────────────────────────────────────────────────────────

    def rebuild_bm25(
        self,
        export_batch_size: int = 5000,
    ) -> Dict:
        """
        Đồng bộ ChromaDB → Parquet → Rebuild BM25 index.

        Luôn export lại parquet từ ChromaDB trước khi rebuild,
        đảm bảo BM25 khớp hoàn toàn với dữ liệu hiện tại trong DB.

        Parameters
        ----------
        export_batch_size : int
            Số chunks mỗi lần get() từ ChromaDB khi export. Mặc định: 5000.

        Returns
        -------
        {
            "status"        : "ok" | "error",
            "rows_exported" : {"legal": int, "forms": int, "examples": int},
            "elapsed_s"     : float,
            "error"         : str,   # chỉ khi status == "error"
        }
        """
        t0 = time.time()
        parquet_files = {
            "legal"   : CHUNK_DIR / "legal_chunks.parquet",
            "forms"   : CHUNK_DIR / "forms_chunks.parquet",
            "examples": CHUNK_DIR / "examples_chunks.parquet",
        }
        rows_exported: Dict[str, int] = {}

        # BƯỚC 1: Export ChromaDB → Parquet
        logger.info("rebuild_bm25: Bước 1 — Export ChromaDB → Parquet...")
        CHUNK_DIR.mkdir(parents=True, exist_ok=True)

        for col_key, pq_path in parquet_files.items():
            try:
                col   = self._get_collection(col_key)
                total = col.count()
                logger.info(f"  [{col_key}] Exporting {total:,} chunks...")

                all_ids, all_docs, all_metas = [], [], []
                offset = 0
                while offset < total:
                    batch = col.get(
                        limit=export_batch_size,
                        offset=offset,
                        include=["documents", "metadatas"],
                    )
                    all_ids.extend(batch["ids"])
                    all_docs.extend(batch["documents"])
                    all_metas.extend(batch["metadatas"])
                    offset += len(batch["ids"])

                rows = []
                for chroma_id, doc_text, meta in zip(all_ids, all_docs, all_metas):
                    row = {"chunk_id": chroma_id, "text": doc_text}
                    for mc in PARQUET_META_COLS:
                        row[mc] = meta.get(mc, "")
                    rows.append(row)

                df = pd.DataFrame(rows)
                for int_col in ["chunk_index", "total_chunks", "word_count"]:
                    if int_col in df.columns:
                        df[int_col] = pd.to_numeric(df[int_col], errors="coerce").fillna(0).astype(int)

                df.to_parquet(pq_path, index=False)
                rows_exported[col_key] = len(df)
                logger.info(f"  [{col_key}] Saved {len(df):,} rows → {pq_path.name}")

            except Exception as e:
                logger.error(f"  [{col_key}] Export lỗi: {e}")
                rows_exported[col_key] = -1

        # BƯỚC 2: Rebuild BM25
        logger.info("rebuild_bm25: Bước 2 — Rebuild BM25 index (force_rebuild_bm25=True)...")
        try:
            import hybrid_retrieval as hr
            from hybrid_retrieval import init_retriever
            # Inject embed model đang dùng vào hybrid_retrieval trước khi gọi
            # init_retriever(), tránh load lại model lần thứ 3.
            hr._embed_model = self._embed_model
            init_retriever(force_rebuild_bm25=True)
        except ImportError as e:
            msg = f"Không import được hybrid_retrieval: {e}"
            logger.error(f"rebuild_bm25: {msg}")
            return {"status": "error", "rows_exported": rows_exported,
                    "elapsed_s": round(time.time()-t0, 1), "error": msg}
        except Exception as e:
            msg = f"init_retriever() thất bại: {e}"
            logger.error(f"rebuild_bm25: {msg}")
            return {"status": "error", "rows_exported": rows_exported,
                    "elapsed_s": round(time.time()-t0, 1), "error": msg}

        elapsed = round(time.time() - t0, 1)
        logger.info(f"rebuild_bm25: Hoàn tất trong {elapsed}s ({elapsed/60:.1f} phút)")

        return {"status": "ok", "rows_exported": rows_exported, "elapsed_s": elapsed}


# ============================================================
# MODULE-LEVEL SINGLETON (tuỳ chọn)
# ============================================================
_updater_instance: Optional[DocumentUpdater] = None


def get_updater(**kwargs) -> DocumentUpdater:
    """
    Trả về singleton DocumentUpdater.
    Phù hợp cho server / notebook dùng lâu dài.

    Example:
        from updateDB import get_updater
        updater = get_updater()
        updater.ingest(ocr_text=..., manual_so_hieu="134/2025/QH15")
    """
    global _updater_instance
    if _updater_instance is None:
        _updater_instance = DocumentUpdater(**kwargs)
    return _updater_instance


# ============================================================
# CLI
# ============================================================
def _run_ingest_interactive(updater: "DocumentUpdater", file_path: str, ministry: str) -> None:
    """
    Ingest văn bản OCR từ file với flow giữ nguyên logic notebook Cell 2b + Cell 10:
      1. Load file → hiển thị preview
      2. Auto-detect + confirm số hiệu (có thể sửa)
      3. Dry-run preview (luôn safe)
      4. Double confirm trước khi thực thi thật
      5. Rebuild BM25 sau khi ingest thành công
    """
    import sys

    # ── BƯỚC 1: Load file ────────────────────────────────────────────────────
    path = Path(file_path)
    if not path.exists():
        print(f"❌ Không tìm thấy file: {path}")
        sys.exit(1)

    try:
        raw_ocr_text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raw_ocr_text = path.read_text(encoding="utf-8-sig")

    file_size_kb = path.stat().st_size / 1024
    print(f"✅ Đã load từ file: {path}")
    print(f"   Kích thước : {file_size_kb:.1f} KB | {len(raw_ocr_text):,} ký tự")
    print(f"\n   --- Preview 300 ký tự đầu ---")
    print("   " + raw_ocr_text[:300].replace("\n", "\n   "))
    print("   " + "─" * 50)

    # ── BƯỚC 2: Auto-detect + confirm số hiệu ───────────────────────────────
    header_preview = _extract_doc_header(raw_ocr_text)
    detected_so_hieu = header_preview.get("so_hieu", "")

    print()
    if detected_so_hieu:
        print(f"   Số hiệu phát hiện: {detected_so_hieu}")
        _confirm_no = input(
            f"   Nhấn Enter để giữ nguyên, hoặc nhập số hiệu khác: "
        ).strip()
        confirmed_so_hieu = _confirm_no if _confirm_no else detected_so_hieu
        if _confirm_no:
            print(f"   → Đã sửa thành: {confirmed_so_hieu}")
        else:
            print(f"   → Giữ nguyên: {confirmed_so_hieu}")
    else:
        print("   ⚠️  Không tự nhận diện được số hiệu.")
        confirmed_so_hieu = input(
            "   Nhập số hiệu văn bản (ví dụ: 134/2025/QH15): "
        ).strip()
        if not confirmed_so_hieu:
            print("❌ Số hiệu không được để trống — dừng.")
            sys.exit(1)
        print(f"   → Số hiệu đã nhập: {confirmed_so_hieu}")

    # ── BƯỚC 3: Dry-run preview (luôn safe) ─────────────────────────────────
    print()
    print("=" * 60)
    print("👁️  CHẾ ĐỘ XEM TRƯỚC (dry_run_delete=True, skip_upsert=True)")
    print("=" * 60)

    report_preview = updater.ingest(
        ocr_text        = raw_ocr_text,
        ministry        = ministry,
        dry_run_delete  = True,
        skip_upsert     = True,
        force_if_exists = True,
        only_new_chunks = False,
        manual_so_hieu  = confirmed_so_hieu,
    )

    # ── BƯỚC 4: Hiển thị tóm tắt preview + double confirm ───────────────────
    so_hieu_final = report_preview["header"].get("so_hieu", "?")
    n_chunks      = report_preview.get("chunks_created", 0)
    n_abolished   = len(report_preview.get("abolished_found", []))
    already_exist = report_preview.get("doc_already_exists", False)
    abolished_nos = [x["so_hieu"] for x in report_preview.get("abolished_found", [])]

    print()
    print("╔══════════════════════════════════════════════════════════╗")
    print("║           ⚠️   XÁC NHẬN TRƯỚC KHI THỰC THI THẬT   ⚠️   ║")
    print("╠══════════════════════════════════════════════════════════╣")
    print(f"║  Số hiệu upsert : {so_hieu_final:<40}║")
    print(f"║  Chunks sẽ thêm : {n_chunks:<40}║")
    print(f"║  Đã có trong DB : {'⚠️  CÓ (sẽ upsert đè)' if already_exist else '✅ Chưa có':<40}║")
    print(f"║  VB bãi bỏ (xoá): {str(abolished_nos)[:40]:<40}║")
    print("╚══════════════════════════════════════════════════════════╝")

    if report_preview.get("errors"):
        print(f"\n❌ Lỗi ở bước xem trước: {report_preview['errors']}")
        print("   Kiểm tra lại input. Pipeline dừng — chưa có gì thay đổi.")
        return

    answer = input("\n▶ Thực thi thật? Nhập ĐỒNG Ý để xác nhận (Enter để huỷ): ").strip()

    if answer.upper() not in ("ĐỒNG Ý", "DONG Y", "Y", "YES", "OK"):
        print("\n⛔ Đã huỷ — không có thay đổi nào được thực hiện.")
        return

    # ── BƯỚC 5: Thực thi thật ────────────────────────────────────────────────
    print("\n✅ Đã xác nhận — bắt đầu thực thi thật...")
    report = updater.ingest(
        ocr_text        = raw_ocr_text,
        ministry        = ministry,
        dry_run_delete  = False,
        skip_upsert     = False,
        force_if_exists = True,
        only_new_chunks = False,
        manual_so_hieu  = confirmed_so_hieu,
    )

    # ── Báo cáo kết quả ──────────────────────────────────────────────────────
    print("\n📄 BÁO CÁO XỬ LÝ:")
    print(f"  Số hiệu       : {report['header'].get('so_hieu', 'N/A')}")
    print(f"  Loại VB       : {report['header'].get('loai_vb', 'N/A')}")
    print(f"  Đã có trong DB: {'⚠️  CÓ' if report['doc_already_exists'] else '✅ Chưa có'}")
    print(f"  Số Điều       : {report['articles_found']}")
    print(f"  Số chunks tạo : {report['chunks_created']}")
    print(f"  Upsert        : {report['upsert_result'].get('upserted', 0)} chunks")
    print(f"  Skip (đã có)  : {report['upsert_result'].get('skipped', 0)} chunks")
    print(f"  VB bãi bỏ     : {len(report['abolished_found'])}")
    deleted_total = sum(r.get("deleted_count", 0) for r in report["delete_results"])
    print(f"  Chunks đã xoá : {deleted_total}")
    all_errors = report.get("errors", []) + report.get("upsert_result", {}).get("errors", [])
    print(f"  Lỗi           : {all_errors if all_errors else 'Không có'}")

    if report["status"] != "ok" or all_errors:
        print("\n⚠️  Ingest có lỗi — BỎ QUA rebuild BM25.")
        return

    # ── BƯỚC 6: Rebuild BM25 ─────────────────────────────────────────────────
    upserted = report["upsert_result"].get("upserted", 0)
    if upserted == 0 and deleted_total == 0:
        print("\nℹ️  Không có thay đổi thực sự — bỏ qua rebuild BM25.")
        return

    print("\n🔄 Rebuild BM25 để đồng bộ với ChromaDB...")
    bm25_result = updater.rebuild_bm25()

    print(f"\n{'✅' if bm25_result['status'] == 'ok' else '❌'} BM25 rebuild: {bm25_result['status']}")
    print(f"   Thời gian : {bm25_result['elapsed_s']}s ({bm25_result['elapsed_s']/60:.1f} phút)")
    print(f"   Rows      : {bm25_result['rows_exported']}")
    if bm25_result.get("error"):
        print(f"   Lỗi       : {bm25_result['error']}")
        print("   ⚠️  Rebuild BM25 thất bại — nhớ rebuild thủ công sau.")
    else:
        print("   ✅ BM25 đã đồng bộ xong.")


if __name__ == "__main__":
    import argparse
    import sys

    logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")

    parser = argparse.ArgumentParser(
        description="updateDB — Cập nhật ChromaDB từ văn bản OCR",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument(
        "--mode",
        choices=["ingest", "status", "check", "delete", "rebuild"],
        default="ingest",
        help=(
            "ingest  : Load file OCR → ingest vào ChromaDB → rebuild BM25 (mặc định)\n"
            "status  : Xem số chunks hiện có trong DB\n"
            "check   : Kiểm tra văn bản đã có trong DB chưa (cần --so-hieu)\n"
            "delete  : Xoá văn bản khỏi DB (cần --so-hieu)\n"
            "rebuild : Đồng bộ Parquet + rebuild BM25\n"
        ),
    )
    parser.add_argument(
        "--file", type=str, default="",
        help="Đường dẫn tới file .txt chứa nội dung OCR (dùng cho --mode ingest)",
    )
    parser.add_argument(
        "--ministry", type=str, default="",
        help="Cơ quan ban hành, VD: 'Chính phủ' (tuỳ chọn, dùng cho --mode ingest)",
    )
    parser.add_argument(
        "--so-hieu", type=str, default="",
        help="Số hiệu văn bản (dùng cho --mode check/delete)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Xem trước, không thực hiện thật (dùng cho --mode delete)",
    )
    args = parser.parse_args()

    updater = DocumentUpdater()

    if args.mode == "ingest":
        # Hỏi đường dẫn nếu không truyền qua CLI
        file_path = args.file.strip()
        if not file_path:
            file_path = input("📂 Nhập đường dẫn file OCR (.txt): ").strip()
        if not file_path:
            print("❌ Đường dẫn file không được để trống.")
            sys.exit(1)
        _run_ingest_interactive(updater, file_path, ministry=args.ministry)

    elif args.mode == "status":
        print("\n📊 ChromaDB Status:")
        for col_name, count in updater.db_status().items():
            status = f"{count:,} chunks" if count >= 0 else "❌ lỗi"
            print(f"  {col_name}: {status}")

    elif args.mode == "check":
        if not args.so_hieu:
            print("❌ Cần --so-hieu")
            sys.exit(1)
        info = updater.check_doc(args.so_hieu)
        print(f"\n📋 '{args.so_hieu}': {'ĐÃ TỒN TẠI' if info['exists'] else 'Chưa có'}")
        if info["exists"]:
            print(f"   Chunks: {info['chunk_count']:,} | Điều: {info['article_count']}")

    elif args.mode == "delete":
        if not args.so_hieu:
            print("❌ Cần --so-hieu")
            sys.exit(1)
        result = updater.delete_doc(args.so_hieu, dry_run=args.dry_run)
        prefix = "[DRY RUN] " if args.dry_run else ""
        print(f"\n{prefix}Xoá '{args.so_hieu}': {len(result['found_ids'])} chunks tìm thấy, "
              f"{result['deleted_count']} đã xoá")

    elif args.mode == "rebuild":
        print("\n🔄 Rebuild BM25...")
        result = updater.rebuild_bm25()
        print(f"\nStatus : {result['status']}")
        print(f"Elapsed: {result['elapsed_s']}s")
        print(f"Rows   : {result['rows_exported']}")
        if result.get("error"):
            print(f"Error  : {result['error']}")