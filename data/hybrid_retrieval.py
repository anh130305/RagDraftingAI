"""
hybrid_retrieval.py
===================
Module tái sử dụng cho RAG pipeline - Soạn thảo Văn bản Hành chính Việt Nam.

Usage:
    from hybrid_retrieval import init_retriever, retrieve_all, retrieve_legal,
                                  retrieve_forms, retrieve_examples

    # Khởi tạo 1 lần khi start server/pipeline
    init_retriever()

    # Sử dụng
    results = retrieve_all("soạn thảo quyết định bổ nhiệm cán bộ")
    legal    = results["legal"]    # List[Dict] — top-3 điều luật
    form     = results["form"]     # List[Dict] — 1 form template
    examples = results["examples"] # List[Dict] — top-3 ví dụ

Yêu cầu:
    pip install rank-bm25 sentence-transformers chromadb unicodedata2 pandas pyarrow torch
"""

from __future__ import annotations

import re
import time
import pickle
import unicodedata
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import torch
import chromadb
from chromadb.config import Settings
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer, CrossEncoder

# ============================================================
# CONFIG — chỉnh lại paths nếu cần
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
MAX_EXPAND_CHUNKS  = 6

INSTRUCTIONS = {
    "legal"   : "Instruct: Tim dieu khoan phap luat Viet Nam lien quan.\nQuery: ",
    "forms"   : "Instruct: Tim mau bieu hanh chinh phu hop voi nhu cau soan thao.\nQuery: ",
    "examples": "Instruct: Tim vi du van ban hanh chinh tuong tu tinh huong sau.\nQuery: ",
}

# ============================================================
# FORM KEYWORD MAP — đủ 10 form
# ============================================================
FORM_KEYWORD_MAP: List[Tuple[str, List[str]]] = [
    # Form_01 — Nghị quyết cá biệt
    (r"nghi\s*quyet",                                               ["Form_01"]),
    # Form_02 — Quyết định cá biệt | Form_03 — Quyết định ban hành VB kèm theo
    (r"quyet\s*dinh",                                               ["Form_02", "Form_03"]),
    # Form_04 — Mẫu đa năng (17 loại VB có tên loại chung)
    (r"to\s*trinh|trinh\s*duyet|trinh\s*phe\s*duyet",              ["Form_04"]),
    (r"bao\s*cao",                                                  ["Form_04"]),
    (r"chi\s*thi",                                                  ["Form_04"]),
    (r"thong\s*bao|thong\s*cao",                                    ["Form_04"]),
    (r"huong\s*dan",                                                ["Form_04"]),
    (r"ke\s*hoach|chuong\s*trinh|phuong\s*an|de\s*an|du\s*an",     ["Form_04"]),
    (r"quy\s*che|quy\s*dinh",                                       ["Form_04"]),
    (r"uy\s*quyen|giay\s*uy\s*quyen",                               ["Form_04"]),
    (r"phieu\s*gui|phieu\s*chuyen|phieu\s*bao",                     ["Form_04"]),
    # Form_05 — Công văn
    (r"cong\s*van",                                                 ["Form_05"]),
    # Form_06 — Công điện (thông báo khẩn)
    (r"cong\s*dien|khan\s*cap|thong\s*bao\s*khan",                  ["Form_06"]),
    # Form_07 — Giấy mời họp/hội nghị/hội thảo
    (r"giay\s*moi|thu\s*moi|moi\s*hop|moi\s*hoi\s*nghi",           ["Form_07"]),
    # Form_08 — Giấy giới thiệu
    (r"giay\s*gioi\s*thieu|gioi\s*thieu\s*can\s*bo",                ["Form_08"]),
    # Form_09 — Biên bản họp/hội nghị
    (r"bien\s*ban",                                                 ["Form_09"]),
    # Form_10 — Giấy nghỉ phép
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
    Normalize query → bỏ dấu → match regex → trả List[form_id] hoặc None.
    None = không detect được → caller dùng fallback dense search.
    """
    q_norm = remove_diacritics(normalize_text(query))
    candidates = []
    for pattern, form_ids in _COMPILED_FORM_PATTERNS:
        if pattern.search(q_norm):
            for fid in form_ids:
                if fid not in candidates:
                    candidates.append(fid)
    return candidates if candidates else None


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
    meta_path = save_path.with_suffix(".meta.pkl")
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
    print(f"  Done in {time.time()-t0:.1f}s")
    return bm25, chunk_ids


# ============================================================
# HYBRID RETRIEVER CLASS
# ============================================================

class HybridRetrieverV3:
    """
    BM25 bigram + ChromaDB dense + RRF + CrossEncoder reranker + dedup.
    """

    def __init__(
        self,
        bm25_index: BM25Okapi,
        bm25_ids: List[str],
        chroma_col,
        meta_lookup: Dict,
        embed_model: SentenceTransformer,
        reranker: CrossEncoder,
        instruction: str,
        collection_name: str,
        bm25_top_k: int        = BM25_TOP_K,
        dense_top_k: int       = DENSE_TOP_K,
        rrf_k: int             = RRF_K,
        rerank_top_n: int      = RERANK_TOP_N,
        final_top_k: int       = FINAL_TOP_K,
        max_chunks_per_doc: int = MAX_CHUNKS_PER_DOC,
    ):
        self.bm25               = bm25_index
        self.bm25_ids           = bm25_ids
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

    def _bm25_search(self, query: str) -> List[Tuple[str, float]]:
        tokens = tokenize_for_bm25(query)
        if not tokens:
            return []
        scores  = self.bm25.get_scores(tokens)
        top_idx = np.argsort(scores)[::-1][: self.bm25_top_k]
        return [(self.bm25_ids[i], float(scores[i])) for i in top_idx if scores[i] > 0]

    def _dense_search(
        self, query: str, where: Optional[Dict] = None
    ) -> List[Tuple[str, float, str, Dict]]:
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
        bm25_results: List[Tuple[str, float]],
        dense_results: List[Tuple[str, float, str, Dict]],
    ) -> List[Tuple[str, float]]:
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
            bm25_res  = self._bm25_search(query)
            dense_res = self._dense_search(query, where=where)

        doc_texts:   Dict[str, str]  = {}
        chroma_meta: Dict[str, Dict] = {}
        for cid, _, doc, meta in dense_res:
            doc_texts[cid]   = doc
            chroma_meta[cid] = meta
        for cid, _ in bm25_res:
            if cid not in doc_texts and cid in self.meta:
                doc_texts[cid]   = self.meta[cid].get("text", "")
                chroma_meta[cid] = self.meta[cid]

        bm25_score_map = {cid: s for cid, s in bm25_res}
        dense_dist_map = {cid: d for cid, d, _, _ in dense_res}

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
            })
        return results


# ============================================================
# MODULE-LEVEL STATE (khởi tạo qua init_retriever)
# ============================================================
_retriever_legal:    Optional[HybridRetrieverV3] = None
_retriever_forms:    Optional[HybridRetrieverV3] = None
_retriever_examples: Optional[HybridRetrieverV3] = None
_col_forms:          Optional[object]            = None
_reranker:           Optional[CrossEncoder]      = None
_expand_index:       Dict[Tuple[str, str], List[Tuple[int, str]]] = {}


def init_retriever(
    force_rebuild_bm25: bool = False,
    device: Optional[str] = None,
) -> None:
    """
    Khởi tạo toàn bộ pipeline: load model, BM25, ChromaDB.
    Gọi 1 lần khi start application.
    """
    global _retriever_legal, _retriever_forms, _retriever_examples
    global _col_forms, _reranker, _expand_index
    global _COMPILED_FORM_PATTERNS

    _dev = device or DEVICE

    # Compile patterns
    _COMPILED_FORM_PATTERNS = [
        (re.compile(pat, re.IGNORECASE), fids)
        for pat, fids in FORM_KEYWORD_MAP
    ]

    # Ensure dirs
    for d in [BM25_DIR, MODEL_EMBED, MODEL_RERANK]:
        d.mkdir(parents=True, exist_ok=True)

    # Load chunk DataFrames
    print("Loading chunk files...")
    df_legal    = pd.read_parquet(CHUNK_DIR / "legal_chunks.parquet")
    df_forms    = pd.read_parquet(CHUNK_DIR / "forms_chunks.parquet")
    df_examples = pd.read_parquet(CHUNK_DIR / "examples_chunks.parquet")
    print(f"  legal={len(df_legal):,}  forms={len(df_forms)}  examples={len(df_examples)}")

    # BM25 indexes
    bm25_legal, ids_legal = _build_bm25_index(
        df_legal, "text", BM25_DIR / "bm25_legal_v2.pkl", "legal", force_rebuild_bm25
    )
    bm25_forms, ids_forms = _build_bm25_index(
        df_forms, "text", BM25_DIR / "bm25_forms_v2.pkl", "forms", force_rebuild_bm25
    )
    bm25_examples, ids_examples = _build_bm25_index(
        df_examples, "text", BM25_DIR / "bm25_examples_v2.pkl", "examples", force_rebuild_bm25
    )

    # Metadata lookups (fallback cho BM25-only hits)
    legal_meta    = df_legal.set_index("chunk_id").to_dict(orient="index")
    forms_meta    = df_forms.set_index("chunk_id").to_dict(orient="index")
    examples_meta = df_examples.set_index("chunk_id").to_dict(orient="index")

    # Expand index: (doc_id, article) → sorted chunks
    print("Building expand index...")
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
    embed_model = SentenceTransformer(
        EMBED_MODEL_NAME, device=_dev, cache_folder=str(MODEL_EMBED)
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

    # Reranker
    print("Loading reranker...")
    _reranker = CrossEncoder(
        RERANK_MODEL_NAME, device=_dev, cache_folder=str(MODEL_RERANK), max_length=512
    )

    # Instantiate retrievers
    _retriever_legal = HybridRetrieverV3(
        bm25_index=bm25_legal, bm25_ids=ids_legal,
        chroma_col=col_legal_all, meta_lookup=legal_meta,
        embed_model=embed_model, reranker=_reranker,
        instruction=INSTRUCTIONS["legal"], collection_name="legal",
    )
    _retriever_forms = HybridRetrieverV3(
        bm25_index=bm25_forms, bm25_ids=ids_forms,
        chroma_col=_col_forms, meta_lookup=forms_meta,
        embed_model=embed_model, reranker=_reranker,
        instruction=INSTRUCTIONS["forms"], collection_name="forms",
        final_top_k=1, max_chunks_per_doc=1,
    )
    _retriever_examples = HybridRetrieverV3(
        bm25_index=bm25_examples, bm25_ids=ids_examples,
        chroma_col=col_examples, meta_lookup=examples_meta,
        embed_model=embed_model, reranker=_reranker,
        instruction=INSTRUCTIONS["examples"], collection_name="examples",
        final_top_k=3, max_chunks_per_doc=1,
    )
    print("✅ Retriever initialized.")


def _check_init() -> None:
    if _retriever_legal is None:
        raise RuntimeError("Retriever chưa được khởi tạo. Gọi init_retriever() trước.")


# ============================================================
# EXPAND HELPER
# ============================================================

def _expand_legal_chunk(metadata: Dict, max_chunks: int = MAX_EXPAND_CHUNKS) -> str:
    doc_id  = metadata.get("doc_id", "")
    article = metadata.get("article", "")
    key     = (doc_id, article)
    if key not in _expand_index:
        return metadata.get("text", "")
    chunks = _expand_index[key][:max_chunks]
    texts  = [text for _, text in chunks]
    if len(texts) == 1:
        return texts[0]
    merged = [texts[0]]
    for t in texts[1:]:
        lines = t.split("\n")
        if lines and lines[0].startswith("[") and article in lines[0]:
            t = "\n".join(lines[1:]).strip()
        if t:
            merged.append(t)
    return "\n".join(merged)


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
        expand      : Ghép full điều luật (recommended: True)
    """
    _check_init()
    _retriever_legal.final_top_k = top_k
    results = _retriever_legal.retrieve(
        query, type_filter=type_filter, use_reranker=use_reranker
    )
    if not expand:
        return results
    for r in results:
        key = (r["metadata"].get("doc_id", ""), r["metadata"].get("article", ""))
        n_chunks = len(_expand_index.get(key, []))
        r["text"]             = _expand_legal_chunk(r["metadata"])
        r["n_chunks_expanded"] = min(n_chunks, MAX_EXPAND_CHUNKS)
    return results


def retrieve_forms(
    query: str,
    use_reranker: bool = True,
) -> List[Dict]:
    """
    Retrieve biểu mẫu hành chính phù hợp nhất.
    Trả về List[Dict] với 1 form duy nhất.
    """
    _check_init()
    form_candidates = detect_form_candidates(query)

    if not form_candidates:
        return _retriever_forms.retrieve(query, use_reranker=use_reranker)

    if len(form_candidates) == 1:
        res = _col_forms.get(
            where={"form_id": form_candidates[0]},
            include=["documents", "metadatas"],
        )
        if res["ids"]:
            return [{
                "chunk_id"    : res["ids"][0],
                "text"        : res["documents"][0],
                "metadata"    : res["metadatas"][0],
                "rerank_score": 1.0,
                "source"      : "keyword_match",
            }]
        return _retriever_forms.retrieve(query, use_reranker=use_reranker)

    # Nhiều candidates → rerank
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
            "legal"   : top-k điều luật (expanded full text),
            "form"    : 1 form template phù hợp nhất,
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

def main():
    # 1. Khởi tạo retriever (chạy 1 lần)
    print("Initializing retriever...")
    init_retriever(force_rebuild_bm25=False)

    # 2. Query test
    query = "soạn thảo quyết định bổ nhiệm cán bộ"
    print(f"\nQuery: {query}\n")

    # 3. Retrieve
    results = retrieve_all(query)

    # 4. In kết quả
    print("=" * 80)
    print("LEGAL RESULTS")
    print("=" * 80)
    for i, item in enumerate(results["legal"], 1):
        print(f"\n[{i}] Score: {item['rerank_score']}")
        print(f"Doc: {item['metadata'].get('doc_name', 'N/A')}")
        print(f"Article: {item['metadata'].get('article', 'N/A')}")
        print(f"Text: {item['text'][:300]}...")

    print("\n" + "=" * 80)
    print("FORM RESULT")
    print("=" * 80)
    for i, item in enumerate(results["form"], 1):
        print(f"\n[{i}]")
        print(f"Form type: {item['metadata'].get('form_type', 'N/A')}")
        print(f"Purpose: {item['metadata'].get('purpose', 'N/A')}")
        print(f"Template preview: {item['text'][:300]}...")

    print("\n" + "=" * 80)
    print("EXAMPLES")
    print("=" * 80)
    for i, item in enumerate(results["examples"], 1):
        print(f"\n[{i}]")
        print(f"Scenario: {item['metadata'].get('scenario', 'N/A')}")
        print(f"Text: {item['text'][:300]}...")


# Cho phép chạy trực tiếp
if __name__ == "__main__":
    main()