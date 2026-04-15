"""
hybrid_retrieval_v4.py
======================
Module tái sử dụng cho RAG pipeline - Soạn thảo Văn bản Hành chính Việt Nam.

Fixes so với v3:
  FIX 1 — RRF ID mismatch: BM25 dùng parquet chunk_id, ChromaDB dùng SHA-256.
           Giải pháp: build _bm25_id_to_chroma_id map (chunk_id_raw → ChromaDB ID)
           khi load ChromaDB, để RRF merge đúng cùng không gian ID.

  FIX 2 — retrieve_forms() 1-candidate: col_forms.get() có thể trả nhiều chunk.
           Giải pháp: dùng col_forms.query() với embedding để lấy chunk
           semantically relevant nhất thay vì chunk đầu tiên bất kỳ.

  FIX 3 — expand_legal_chunk() cần 'article' trong metadata ChromaDB.
           Giải pháp: assert 'article' có trong LEGAL_META_COLS khi index,
           và thêm guard: nếu key không tìm thấy, fallback về text gốc + warning.

  FIX 4 — Context window guard cho expand.
           Giải pháp: tính word_count sau expand, cảnh báo nếu vượt ngưỡng,
           và truncate thông minh theo MAX_EXPAND_WORDS thay vì chỉ MAX_EXPAND_CHUNKS.

Usage:
    from hybrid_retrieval_v4 import init_retriever, retrieve_all

    init_retriever()                              # gọi 1 lần khi start
    results = retrieve_all("soạn thảo quyết định bổ nhiệm cán bộ")
    # → {"legal": [...], "form": [...], "examples": [...]}

Requirements:
    pip install rank-bm25 sentence-transformers chromadb unicodedata2 pandas pyarrow torch python-dotenv huggingface_hub
"""

from __future__ import annotations

import hashlib
import re
import time
import pickle
import unicodedata
import warnings
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import torch
import chromadb
from chromadb.config import Settings
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer, CrossEncoder

try:
    from dotenv import load_dotenv
    import os
    from huggingface_hub import login
    load_dotenv()
    _hf_token = os.getenv("HF_TOKEN")
    if _hf_token:
        login(token=_hf_token)
except ImportError:
    pass

# ============================================================
# CONFIG
# ============================================================
PROJECT_ROOT = Path(".")
CHUNK_DIR    = PROJECT_ROOT / "dataset" / "chunks"
CHROMA_DIR   = PROJECT_ROOT / "dataset" / "chromadb"
BM25_DIR     = PROJECT_ROOT / "dataset" / "bm25"
MODEL_EMBED  = PROJECT_ROOT / "models" / "embedding"
MODEL_RERANK = PROJECT_ROOT / "models" / "reranker"

EMBED_MODEL_NAME  = "intfloat/multilingual-e5-large-instruct"
RERANK_MODEL_NAME = "BAAI/bge-reranker-v2-m3"

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

BM25_TOP_K         = 30
DENSE_TOP_K        = 30
RRF_K              = 60
RERANK_TOP_N       = 10
FINAL_TOP_K        = 3
MAX_CHUNKS_PER_DOC = 1
MAX_EXPAND_CHUNKS  = 2
MAX_EXPAND_WORDS   = 600

# INSTRUCTIONS = {
#     "legal"   : "Instruct: Tim dieu khoan phap luat Viet Nam lien quan.\nQuery: ",
#     "forms"   : "Instruct: Tim mau bieu hanh chinh phu hop voi nhu cau soan thao.\nQuery: ",
#     "examples": "Instruct: Tim vi du van ban hanh chinh tuong tu tinh huong sau.\nQuery: ",
# }

INSTRUCTIONS = {
    "legal"   : "Instruct: Tìm điều khoản pháp luật Việt Nam liên quan.\nQuery: ",
    "forms"   : "Instruct: Tìm mẫu biểu hành chính phù hợp với nhu cầu soạn thảo.\nQuery: ",
    "examples": "Instruct: Tìm ví dụ văn bản hành chính tương tự tình huống sau.\nQuery: ",
}

# ============================================================
# FORM KEYWORD MAP
# ============================================================
FORM_KEYWORD_MAP: List[Tuple[str, List[str]]] = [
    (r"nghi\s*quyet",                                               ["Form_01"]),
    (r"quyet\s*dinh",                                               ["Form_02", "Form_03"]),
    (r"to\s*trinh|trinh\s*duyet|trinh\s*phe\s*duyet",              ["Form_04"]),
    (r"bao\s*cao",                                                  ["Form_04"]),
    (r"chi\s*thi",                                                  ["Form_04"]),
    (r"thong\s*bao|thong\s*cao",                                    ["Form_04"]),
    (r"huong\s*dan",                                                ["Form_04"]),
    (r"ke\s*hoach|chuong\s*trinh|phuong\s*an|de\s*an|du\s*an",     ["Form_04"]),
    (r"quy\s*che|quy\s*dinh",                                       ["Form_04"]),
    (r"uy\s*quyen|giay\s*uy\s*quyen",                               ["Form_04"]),
    (r"phieu\s*gui|phieu\s*chuyen|phieu\s*bao",                     ["Form_04"]),
    (r"cong\s*van",                                                 ["Form_05"]),
    (r"cong\s*dien|khan\s*cap|thong\s*bao\s*khan",                  ["Form_06"]),
    (r"giay\s*moi|thu\s*moi|moi\s*hop|moi\s*hoi\s*nghi",           ["Form_07"]),
    (r"giay\s*gioi\s*thieu|gioi\s*thieu\s*can\s*bo",                ["Form_08"]),
    (r"bien\s*ban",                                                 ["Form_09"]),
    (r"giay\s*nghi\s*phep|nghi\s*phep|xin\s*nghi",                 ["Form_10"]),
]

_COMPILED_FORM_PATTERNS: List[Tuple[re.Pattern, List[str]]] = []

# ============================================================
# TEXT NORMALIZATION
# ============================================================

def remove_diacritics(text: str) -> str:
    nfd = unicodedata.normalize("NFD", text)
    stripped = "".join(c for c in nfd if unicodedata.category(c) != "Mn")
    return stripped.replace("đ", "d").replace("Đ", "D")


def normalize_text(text: str) -> str:
    text = str(text).lower().strip()
    return re.sub(r"\s+", " ", text)


def tokenize_for_bm25(text: str, use_bigrams: bool = True) -> List[str]:
    """Bigram tokenization: unigrams ≥2 ký tự + bigrams từ all_tokens."""
    text = normalize_text(text)
    text = remove_diacritics(text)
    all_tokens = re.findall(r"[a-z][a-z0-9]*", text)
    unigrams   = [t for t in all_tokens if len(t) >= 2]
    if not use_bigrams:
        return unigrams
    bigrams = [f"{a}_{b}" for a, b in zip(all_tokens, all_tokens[1:])]
    return unigrams + bigrams


# ============================================================
# KEYWORD DETECTION
# ============================================================

def detect_form_candidates(query: str) -> Optional[List[str]]:
    """
    Normalize query → bỏ dấu → tìm pattern match có vị trí xuất hiện
    sớm nhất trong query → trả List[form_id] của pattern đó.

    Thay vì gom tất cả match (dẫn đến conflict "công văn" + "hướng dẫn"),
    chỉ lấy pattern nào xuất hiện gần đầu query nhất — đó thường là
    loại văn bản chính cần soạn, không phải chủ đề nội dung.

    None = không detect được → caller dùng fallback dense search.
    """
    q_norm = remove_diacritics(normalize_text(query))

    best_pos: int = len(q_norm) + 1   # sentinel: lớn hơn mọi vị trí thực
    best_form_ids: Optional[List[str]] = None

    for pattern, form_ids in _COMPILED_FORM_PATTERNS:
        m = pattern.search(q_norm)
        if m and m.start() < best_pos:
            best_pos = m.start()
            best_form_ids = form_ids

    return best_form_ids


# ============================================================
# FIX 1: ChromaDB ID Helper
# ============================================================

def _make_chroma_id(doc_id: str, chunk_index: int, text: str) -> str:
    """
    Tái tạo ChromaDB ID giống hệt embedAndIndex.ipynb:
        SHA-256[:24] của f"{doc_id}|{chunk_index}|{text[:200]}"
    Dùng để build bảng ánh xạ chunk_id (parquet) → chroma_id.
    """
    raw = f"{doc_id}|{chunk_index}|{text[:200]}"
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


def _build_chroma_id_map(df: pd.DataFrame) -> Dict[str, str]:
    """
    FIX 1: Build bảng ánh xạ parquet chunk_id → ChromaDB SHA-256 ID.
    BM25 trả về parquet chunk_id; cần convert sang chroma_id trước khi RRF.
    """
    mapping: Dict[str, str] = {}
    for row in df.itertuples(index=False):
        chroma_id = _make_chroma_id(
            str(row.doc_id),
            int(row.chunk_index),
            str(row.text),
        )
        mapping[str(row.chunk_id)] = chroma_id
    return mapping


# ============================================================
# BM25 INDEX BUILDER
# ============================================================

def _build_bm25_index(
    df: pd.DataFrame,
    text_col: str,
    save_path: Path,
    name: str,
    force_rebuild: bool = False,
) -> Tuple[BM25Okapi, List[str]]:
    """Build hoặc load BM25 index. Trả về (bm25, list_of_parquet_chunk_ids)."""
    meta_path = save_path.with_suffix(".meta.pkl")

    assert "chunk_id" in df.columns, f"[{name}] DataFrame thiếu cột 'chunk_id'"

    if save_path.exists() and meta_path.exists() and not force_rebuild:
        print(f"[{name}] Loading BM25 from cache: {save_path}")
        with open(save_path, "rb") as f:
            bm25 = pickle.load(f)
        with open(meta_path, "rb") as f:
            meta = pickle.load(f)
        print(f"  Loaded {len(meta['chunk_ids']):,} docs")
        return bm25, meta["chunk_ids"]

    print(f"[{name}] Building BM25 bigram index ({len(df):,} docs)...")
    t0 = time.time()
    chunk_ids     = df["chunk_id"].tolist()
    corpus_tokens = [tokenize_for_bm25(t) for t in df[text_col]]
    bm25 = BM25Okapi(corpus_tokens)
    with open(save_path, "wb") as f:
        pickle.dump(bm25, f, protocol=pickle.HIGHEST_PROTOCOL)
    with open(meta_path, "wb") as f:
        pickle.dump({"chunk_ids": chunk_ids}, f, protocol=pickle.HIGHEST_PROTOCOL)
    print(f"  Done in {time.time()-t0:.1f}s | {save_path.stat().st_size/1024/1024:.1f} MB")
    return bm25, chunk_ids


# ============================================================
# HYBRID RETRIEVER CLASS
# ============================================================

class HybridRetrieverV4:
    """
    BM25 bigram + ChromaDB dense + RRF (ID-corrected) + CrossEncoder reranker + dedup.

    FIX 1: BM25 chunk_ids được convert sang ChromaDB IDs trước khi đưa vào RRF,
    đảm bảo merge đúng khi 1 chunk xuất hiện ở cả hai nguồn → boost score.
    """

    def __init__(
        self,
        bm25_index: BM25Okapi,
        bm25_ids: List[str],               # parquet chunk_ids
        bm25_to_chroma: Dict[str, str],    # FIX 1: map parquet→chroma ID
        chroma_col,
        meta_lookup: Dict,                 # parquet chunk_id → row dict (fallback)
        embed_model: SentenceTransformer,
        reranker: CrossEncoder,
        instruction: str,
        collection_name: str,
        bm25_top_k: int         = BM25_TOP_K,
        dense_top_k: int        = DENSE_TOP_K,
        rrf_k: int              = RRF_K,
        rerank_top_n: int       = RERANK_TOP_N,
        final_top_k: int        = FINAL_TOP_K,
        max_chunks_per_doc: int = MAX_CHUNKS_PER_DOC,
    ):
        self.bm25               = bm25_index
        self.bm25_ids           = bm25_ids
        self.bm25_to_chroma     = bm25_to_chroma   # FIX 1
        self.col                = chroma_col
        self.meta               = meta_lookup
        self.embed_model        = embed_model
        self.reranker           = reranker
        self.instruction        = instruction
        self.name               = collection_name
        self.bm25_top_k         = bm25_top_k
        self.dense_top_k        = dense_top_k
        self.rrf_k              = rrf_k
        self.rerank_top_n       = rerank_top_n
        self.final_top_k        = final_top_k
        self.max_chunks_per_doc = max_chunks_per_doc
        # Cache reverse map một lần, tránh tính lại mỗi query (FIX perf)
        self._chroma_to_parquet = {v: k for k, v in bm25_to_chroma.items()}

    def _bm25_search(self, query: str) -> List[Tuple[str, float]]:
        """
        Trả về List[(chroma_id, bm25_score)].
        FIX 1: convert parquet chunk_id → chroma_id trước khi trả về,
        để RRF merge đúng không gian ID với dense results.
        """
        tokens = tokenize_for_bm25(query)
        if not tokens:
            return []
        scores  = self.bm25.get_scores(tokens)
        top_idx = np.argsort(scores)[::-1][: self.bm25_top_k]

        results = []
        for i in top_idx:
            if scores[i] <= 0:
                continue
            parquet_id = self.bm25_ids[i]
            chroma_id  = self.bm25_to_chroma.get(parquet_id)
            if chroma_id is None:
                # ID chưa có trong map (hiếm) → bỏ qua để tránh ghost entry trong RRF
                continue
            results.append((chroma_id, float(scores[i])))
        return results

    def _dense_search(
        self, query: str, where: Optional[Dict] = None
    ) -> List[Tuple[str, float, str, Dict]]:
        """Trả về List[(chroma_id, distance, doc_text, metadata)]."""
        q_vec = self.embed_model.encode(
            [self.instruction + query],
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )[0]
        kwargs: Dict = dict(
            query_embeddings=[q_vec.tolist()],
            n_results=self.dense_top_k,
            include=["documents", "metadatas", "distances"],
        )
        if where:
            kwargs["where"] = where
        res = self.col.query(**kwargs)
        return [
            (cid, float(dist), doc, meta or {})
            for cid, dist, doc, meta in zip(
                res["ids"][0], res["distances"][0],
                res["documents"][0], res["metadatas"][0],
            )
        ]

    def _rrf(
        self,
        bm25_results: List[Tuple[str, float]],    # (chroma_id, score) — FIX 1
        dense_results: List[Tuple[str, float, str, Dict]],  # (chroma_id, dist, ...)
    ) -> List[Tuple[str, float]]:
        """
        Reciprocal Rank Fusion trên không gian chroma_id thống nhất.
        FIX 1: cả hai danh sách đã dùng cùng chroma_id → overlap được tính đúng.
        """
        scores: Dict[str, float] = {}
        for rank, (cid, _) in enumerate(bm25_results, start=1):
            scores[cid] = scores.get(cid, 0.0) + 1.0 / (self.rrf_k + rank)
        for rank, (cid, _, _, _) in enumerate(dense_results, start=1):
            scores[cid] = scores.get(cid, 0.0) + 1.0 / (self.rrf_k + rank)
        return sorted(scores.items(), key=lambda x: x[1], reverse=True)

    def _rerank(
        self, query: str, candidate_ids: List[str], doc_texts: Dict[str, str]
    ) -> List[Tuple[str, float]]:
        pairs = [(query, doc_texts[cid]) for cid in candidate_ids if cid in doc_texts]
        if not pairs:
            return [(cid, 0.0) for cid in candidate_ids]
        scores = self.reranker.predict(pairs, show_progress_bar=False)
        return sorted(
            zip(candidate_ids[: len(pairs)], scores.tolist()),
            key=lambda x: x[1], reverse=True,
        )

    def _dedup_by_doc(
        self, ranked: List[Tuple[str, float]], chroma_meta: Dict[str, Dict]
    ) -> List[Tuple[str, float]]:
        seen: Dict[str, int] = {}
        result = []
        for cid, score in ranked:
            doc_id = chroma_meta.get(cid, {}).get("doc_id", cid)
            if seen.get(doc_id, 0) < self.max_chunks_per_doc:
                result.append((cid, score))
                seen[doc_id] = seen.get(doc_id, 0) + 1
        return result

    def retrieve(
        self,
        query: str,
        type_filter: Optional[str] = None,
        form_candidates: Optional[List[str]] = None,
        use_reranker: bool = True,
    ) -> List[Dict]:
        t0 = time.time()

        where: Optional[Dict] = None
        if type_filter:
            where = {"type_normalized": type_filter}

        if form_candidates:
            where = (
                {"form_id": form_candidates[0]}
                if len(form_candidates) == 1
                else {"form_id": {"$in": form_candidates}}
            )
            bm25_res  = []
            dense_res = self._dense_search(query, where=where)
        else:
            bm25_res  = self._bm25_search(query)     # trả về chroma_ids
            dense_res = self._dense_search(query, where=where)

        # Build text & metadata lookups (keyed by chroma_id)
        doc_texts:   Dict[str, str]  = {}
        chroma_meta: Dict[str, Dict] = {}
        for cid, _, doc, meta in dense_res:
            doc_texts[cid]   = doc
            chroma_meta[cid] = meta

        # FIX 1: BM25-only hits dùng cached reverse map (nhanh hơn)
        for cid, _ in bm25_res:
            if cid not in doc_texts:
                parquet_id = self._chroma_to_parquet.get(cid)
                if parquet_id and parquet_id in self.meta:
                    doc_texts[cid]   = self.meta[parquet_id].get("text", "")
                    chroma_meta[cid] = self.meta[parquet_id]

        bm25_score_map = {cid: s for cid, s in bm25_res}
        dense_dist_map = {cid: d for cid, d, _, _ in dense_res}

        # RRF — cùng không gian chroma_id
        rrf_ranked    = self._rrf(bm25_res, dense_res)
        top_n_ids     = [cid for cid, _ in rrf_ranked[: self.rerank_top_n]]
        rrf_score_map = {cid: s for cid, s in rrf_ranked}

        if use_reranker and top_n_ids:
            final_ranked = self._rerank(query, top_n_ids, doc_texts)
        else:
            final_ranked = [(cid, rrf_score_map.get(cid, 0.0)) for cid in top_n_ids]

        deduped = self._dedup_by_doc(final_ranked, chroma_meta)

        results = []
        for cid, rerank_score in deduped[: self.final_top_k]:
            meta = chroma_meta.get(cid, {})
            results.append({
                "chunk_id"    : cid,
                "text"        : doc_texts.get(cid, ""),
                "metadata"    : meta,
                "bm25_score"  : round(bm25_score_map.get(cid, 0.0), 4),
                "dense_dist"  : round(dense_dist_map.get(cid, 1.0), 4),
                "rrf_score"   : round(rrf_score_map.get(cid, 0.0), 6),
                "rerank_score": round(float(rerank_score), 4),
                "latency_ms"  : round((time.time() - t0) * 1000, 1),
                "in_both"     : cid in bm25_score_map and cid in dense_dist_map,  # debug
            })
        return results


# ============================================================
# MODULE-LEVEL STATE
# ============================================================
_retriever_legal:    Optional[HybridRetrieverV4] = None
_retriever_forms:    Optional[HybridRetrieverV4] = None
_retriever_examples: Optional[HybridRetrieverV4] = None
_col_forms:          Optional[object]            = None
_reranker:           Optional[CrossEncoder]      = None
_embed_model:        Optional[SentenceTransformer] = None
_expand_index:       Dict[Tuple[str, str], List[Tuple[int, str]]] = {}


def init_retriever(
    force_rebuild_bm25: bool = False,
    device: Optional[str] = None,
) -> None:
    """
    Khởi tạo toàn bộ pipeline: load model, BM25, ChromaDB, build ID map.
    Gọi 1 lần khi start application.
    """
    global _retriever_legal, _retriever_forms, _retriever_examples
    global _col_forms, _reranker, _embed_model, _expand_index
    global _COMPILED_FORM_PATTERNS

    _dev = device or DEVICE

    # Compile regex patterns
    _COMPILED_FORM_PATTERNS = [
        (re.compile(pat, re.IGNORECASE), fids)
        for pat, fids in FORM_KEYWORD_MAP
    ]

    for d in [BM25_DIR, MODEL_EMBED, MODEL_RERANK]:
        d.mkdir(parents=True, exist_ok=True)

    # Load chunk DataFrames
    print("Loading chunk files...")
    df_legal    = pd.read_parquet(CHUNK_DIR / "legal_chunks.parquet")
    df_forms    = pd.read_parquet(CHUNK_DIR / "forms_chunks.parquet")
    df_examples = pd.read_parquet(CHUNK_DIR / "examples_chunks.parquet")
    print(f"  legal={len(df_legal):,}  forms={len(df_forms)}  examples={len(df_examples)}")

    # FIX 3: verify 'article' column present cho expand
    assert "article" in df_legal.columns, \
        "legal_chunks.parquet thiếu cột 'article' — expand sẽ không hoạt động."

    # BM25 indexes
    bm25_legal,    ids_legal    = _build_bm25_index(df_legal,    "text", BM25_DIR / "bm25_legal_v2.pkl",    "legal",    force_rebuild_bm25)
    bm25_forms,    ids_forms    = _build_bm25_index(df_forms,    "text", BM25_DIR / "bm25_forms_v2.pkl",    "forms",    force_rebuild_bm25)
    bm25_examples, ids_examples = _build_bm25_index(df_examples, "text", BM25_DIR / "bm25_examples_v2.pkl", "examples", force_rebuild_bm25)

    # FIX 1: Build chroma_id maps
    print("Building ChromaDB ID maps (FIX 1)...")
    t0 = time.time()
    bm25_to_chroma_legal    = _build_chroma_id_map(df_legal)
    bm25_to_chroma_forms    = _build_chroma_id_map(df_forms)
    bm25_to_chroma_examples = _build_chroma_id_map(df_examples)
    print(f"  legal={len(bm25_to_chroma_legal):,}  forms={len(bm25_to_chroma_forms)}  "
          f"examples={len(bm25_to_chroma_examples)}  ({time.time()-t0:.1f}s)")

    # Metadata lookups (parquet chunk_id → row dict, fallback cho BM25-only hits)
    legal_meta    = df_legal.set_index("chunk_id").to_dict(orient="index")
    forms_meta    = df_forms.set_index("chunk_id").to_dict(orient="index")
    examples_meta = df_examples.set_index("chunk_id").to_dict(orient="index")

    # Expand index: (doc_id, article) → sorted (chunk_index, text)
    print("Building expand index...")
    _expand_index.clear()
    for row in df_legal.itertuples(index=False):
        key = (row.doc_id, row.article)
        if key not in _expand_index:
            _expand_index[key] = []
        _expand_index[key].append((row.chunk_index, row.text))
    for key in _expand_index:
        _expand_index[key].sort(key=lambda x: x[0])
    print(f"  {len(_expand_index):,} (doc_id, article) pairs")

    # Embedding model
    print(f"Loading embedding model ({_dev})...")
    _embed_model = SentenceTransformer(
        EMBED_MODEL_NAME, device=_dev, cache_folder=str(MODEL_EMBED), local_files_only=True
    )

    # ChromaDB
    print("Connecting to ChromaDB...")
    chroma_client = chromadb.PersistentClient(
        path=str(CHROMA_DIR),
        settings=Settings(anonymized_telemetry=False),
    )
    col_legal_all = chroma_client.get_collection("legal_chunks")
    _col_forms    = chroma_client.get_collection("forms_chunks")
    col_examples  = chroma_client.get_collection("examples_chunks")
    print(f"  legal={col_legal_all.count():,}  forms={_col_forms.count()}  examples={col_examples.count()}")

    # FIX 3: Spot-check 'article' có trong ChromaDB metadata
    _sample = col_legal_all.get(limit=1, include=["metadatas"])
    if _sample["metadatas"] and "article" not in _sample["metadatas"][0]:
        warnings.warn(
            "ChromaDB legal_chunks metadata không có field 'article'. "
            "Expand sẽ fallback về text gốc. "
            "Hãy re-embed với LEGAL_META_COLS bao gồm 'article'.",
            RuntimeWarning,
            stacklevel=2,
        )

    # Reranker
    print("Loading reranker...")
    _reranker = CrossEncoder(
        RERANK_MODEL_NAME, device=_dev, cache_folder=str(MODEL_RERANK), max_length=512, local_files_only=True
    )

    # Instantiate retrievers
    _retriever_legal = HybridRetrieverV4(
        bm25_index=bm25_legal, bm25_ids=ids_legal,
        bm25_to_chroma=bm25_to_chroma_legal,
        chroma_col=col_legal_all, meta_lookup=legal_meta,
        embed_model=_embed_model, reranker=_reranker,
        instruction=INSTRUCTIONS["legal"], collection_name="legal",
    )
    _retriever_forms = HybridRetrieverV4(
        bm25_index=bm25_forms, bm25_ids=ids_forms,
        bm25_to_chroma=bm25_to_chroma_forms,
        chroma_col=_col_forms, meta_lookup=forms_meta,
        embed_model=_embed_model, reranker=_reranker,
        instruction=INSTRUCTIONS["forms"], collection_name="forms",
        final_top_k=1, max_chunks_per_doc=1,
    )
    _retriever_examples = HybridRetrieverV4(
        bm25_index=bm25_examples, bm25_ids=ids_examples,
        bm25_to_chroma=bm25_to_chroma_examples,
        chroma_col=col_examples, meta_lookup=examples_meta,
        embed_model=_embed_model, reranker=_reranker,
        instruction=INSTRUCTIONS["examples"], collection_name="examples",
        final_top_k=3, max_chunks_per_doc=1,
    )
    print("✅ Retriever v4 initialized.")


def _check_init() -> None:
    if _retriever_legal is None:
        raise RuntimeError("Retriever chưa được khởi tạo. Gọi init_retriever() trước.")


# ============================================================
# FIX 4: EXPAND HELPER với word-count guard
# ============================================================

def _expand_legal_chunk(
    metadata: Dict,
    fallback_text: str = "",
    max_chunks: int = MAX_EXPAND_CHUNKS,
    max_words: int = MAX_EXPAND_WORDS,
) -> Tuple[str, int]:
    """
    Ghép full điều luật từ expand index.
    FIX 3: guard khi 'article' vắng trong metadata → fallback về text gốc + warning.
    FIX 4: truncate khi tổng từ vượt max_words → tránh overflow context window.

    Returns:
        (expanded_text, n_chunks_used)
    """
    doc_id  = metadata.get("doc_id", "")
    article = metadata.get("article", "")

    # FIX 3: guard thiếu article
    if not article:
        warnings.warn(
            f"metadata thiếu 'article' cho doc_id='{doc_id}'. "
            "Expand fallback về text gốc. Kiểm tra lại LEGAL_META_COLS khi re-embed.",
            RuntimeWarning, stacklevel=2,
        )
        return fallback_text, 1

    key = (doc_id, article)
    if key not in _expand_index:
        return fallback_text, 1

    all_chunks = _expand_index[key]
    merged_parts: List[str] = []
    total_words = 0
    n_used = 0

    for idx, (chunk_idx, text) in enumerate(all_chunks[:max_chunks]):
        # Bỏ header lặp lại ở chunk 2+ (dạng "[Điều X. ...]")
        if idx > 0:
            lines = text.split("\n")
            if lines and lines[0].startswith("[") and article in lines[0]:
                text = "\n".join(lines[1:]).strip()
        if not text:
            continue

        # FIX 4: word-count guard
        chunk_words = len(text.split())
        if total_words + chunk_words > max_words:
            # Thêm phần còn lại của chunk cuối nếu có chỗ
            remaining = max_words - total_words
            if remaining > 50:  # chỉ thêm nếu còn ý nghĩa (>50 từ)
                truncated = " ".join(text.split()[:remaining])
                merged_parts.append(truncated + " [...]")
                n_used += 1
            break

        merged_parts.append(text)
        total_words += chunk_words
        n_used += 1

    if not merged_parts:
        return fallback_text, 1

    return "\n".join(merged_parts), n_used


# ============================================================
# PUBLIC API
# ============================================================

def retrieve_legal(
    query: str,
    top_k: int = FINAL_TOP_K,
    type_filter: Optional[str] = None,
    use_reranker: bool = True,
    expand: bool = True,
) -> List[Dict]:
    """
    Retrieve điều khoản pháp luật liên quan.

    Args:
        query       : Câu truy vấn tiếng Việt
        top_k       : Số điều luật trả về (default 3)
        type_filter : "LUẬT" | "NGHỊ ĐỊNH" | "NGHỊ QUYẾT" | "PHÁP LỆNH"
        use_reranker: Dùng CrossEncoder (chậm hơn, chính xác hơn)
        expand      : Ghép full điều luật từ parquet (recommended: True)
    """
    _check_init()
    _retriever_legal.final_top_k = top_k
    results = _retriever_legal.retrieve(
        query, type_filter=type_filter, use_reranker=use_reranker
    )
    if not expand:
        return results

    for r in results:
        expanded_text, n_used = _expand_legal_chunk(
            metadata=r["metadata"],
            fallback_text=r["text"],
        )
        r["text"]             = expanded_text
        r["n_chunks_expanded"] = n_used
        r["expanded_words"]   = len(expanded_text.split())

    return results


def retrieve_forms(
    query: str,
    use_reranker: bool = True,
) -> List[Dict]:
    """
    Retrieve biểu mẫu hành chính phù hợp nhất.
    Trả về List[Dict] với 1 form duy nhất.

    FIX 2: 1-candidate path dùng query() thay vì get() để đảm bảo
    chunk được chọn là semantic-relevant nhất với query (không phải chunk đầu tiên ngẫu nhiên).
    """
    _check_init()
    form_candidates = detect_form_candidates(query)

    if not form_candidates:
        return _retriever_forms.retrieve(query, use_reranker=use_reranker)

    if len(form_candidates) == 1:
        # FIX 2: dùng dense query thay vì get() để lấy chunk relevant nhất
        q_vec = _embed_model.encode(
            [INSTRUCTIONS["forms"] + query],
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )[0]
        res = _col_forms.query(
            query_embeddings=[q_vec.tolist()],
            n_results=1,
            where={"form_id": form_candidates[0]},
            include=["documents", "metadatas", "distances"],
        )
        if res["ids"] and res["ids"][0]:
            return [{
                "chunk_id"    : res["ids"][0][0],
                "text"        : res["documents"][0][0],
                "metadata"    : res["metadatas"][0][0],
                "dense_dist"  : round(float(res["distances"][0][0]), 4),
                "rerank_score": 1.0,
                "source"      : "keyword_match",
            }]
        # form_id không tồn tại trong DB → fallback dense
        return _retriever_forms.retrieve(query, use_reranker=use_reranker)

    # Nhiều candidates → fetch tất cả rồi rerank
    res = _col_forms.get(
        where={"form_id": {"$in": form_candidates}},
        include=["documents", "metadatas"],
    )
    if not res["ids"]:
        return _retriever_forms.retrieve(query, use_reranker=use_reranker)

    candidates_list = [
        {"chunk_id": cid, "text": doc, "metadata": meta, "source": "keyword_match"}
        for cid, doc, meta in zip(res["ids"], res["documents"], res["metadatas"])
    ]
    if use_reranker and len(candidates_list) > 1:
        scores = _reranker.predict([(query, c["text"]) for c in candidates_list])
        for c, s in zip(candidates_list, scores):
            c["rerank_score"] = float(s)
        candidates_list.sort(key=lambda x: x["rerank_score"], reverse=True)
    else:
        for c in candidates_list:
            c["rerank_score"] = 1.0
    return [candidates_list[0]]


def retrieve_examples(
    query: str,
    top_k: int = 3,
    form_id: Optional[str] = None,
    use_reranker: bool = True,
) -> List[Dict]:
    """
    Retrieve ví dụ văn bản (few-shot examples).
    Ưu tiên: form_id truyền thẳng > keyword detect > fallback dense.
    """
    _check_init()
    _retriever_examples.final_top_k = top_k
    if not form_id:
        _candidates = detect_form_candidates(query)
        form_id = _candidates[0] if _candidates else None
    return _retriever_examples.retrieve(
        query,
        form_candidates=[form_id] if form_id else None,
        use_reranker=use_reranker,
    )


def retrieve_all(
    query: str,
    legal_top_k: int = FINAL_TOP_K,
    examples_top_k: int = 3,
    legal_type_filter: Optional[str] = None,
    expand_legal: bool = True,
) -> Dict[str, List[Dict]]:
    """
    Entry point chính cho RAG generation pipeline.

    Returns:
        {
            "legal"   : top-k điều luật (expanded full text, word-guard),
            "form"    : 1 form template phù hợp nhất (semantic-correct),
            "examples": top-k ví dụ cùng loại form,
        }
    """
    _check_init()
    form_results = retrieve_forms(query)
    detected_form_id = (
        form_results[0]["metadata"].get("form_id") if form_results else None
    )
    return {
        "legal"   : retrieve_legal(
            query, top_k=legal_top_k,
            type_filter=legal_type_filter,
            expand=expand_legal,
        ),
        "form"    : form_results,
        "examples": retrieve_examples(
            query, top_k=examples_top_k,
            form_id=detected_form_id,
        ),
    }


# ============================================================
# MAIN (chạy trực tiếp để smoke test)
# ============================================================
def main():
    print("Initializing retriever v4...")
    init_retriever(force_rebuild_bm25=False)

    query = "soạn thảo quyết định bổ nhiệm cán bộ"
    print(f"\nQuery: {query}\n")
    results = retrieve_all(query)

    print("=" * 70)
    print("LEGAL RESULTS")
    print("=" * 70)
    for i, r in enumerate(results["legal"], 1):
        meta = r["metadata"]
        print(f"\n[{i}] {meta.get('source_doc_no','?')} | {meta.get('type_normalized','')}")
        print(f"     {meta.get('article','')}")
        print(f"     rerank={r['rerank_score']:.4f}  bm25={r['bm25_score']:.2f}  "
              f"dense_dist={r['dense_dist']:.4f}  in_both={r.get('in_both',False)}")
        print(f"     expanded: {r.get('n_chunks_expanded',1)} chunk(s) → {r.get('expanded_words',0)} từ")
        print(f"     {r['text'][:200].replace(chr(10),' ')}...")

    print("\n" + "=" * 70)
    print("FORM RESULT")
    print("=" * 70)
    for r in results["form"]:
        meta = r["metadata"]
        print(f"  {meta.get('form_id','?')} | {meta.get('form_type','')}")
        print(f"  source={r.get('source','pipeline')}  rerank={r.get('rerank_score',0):.4f}")
        print(f"  {meta.get('purpose','')}")

    print("\n" + "=" * 70)
    print("EXAMPLES")
    print("=" * 70)
    for i, r in enumerate(results["examples"], 1):
        meta = r["metadata"]
        print(f"  [{i}] {meta.get('form_id','?')} | rerank={r.get('rerank_score',0):.4f}")
        print(f"       {meta.get('scenario','')[:120]}")


if __name__ == "__main__":
    main()