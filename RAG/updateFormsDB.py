"""
updateFormsDB.py
================
Rebuild Forms templates and examples from files under RAG/Forms, then sync
the forms/examples ChromaDB collections and BM25 indexes.

Inputs
------
  Forms/md/*.md
  Forms/examples/output_Form_*.json

Outputs
-------
  dataset/raw/forms_dataset.parquet
  dataset/raw/forms_examples_dataset.parquet
  dataset/processed/forms_dataset_processed.parquet
  dataset/processed/forms_examples_dataset_processed.parquet
  dataset/chunks/forms_chunks.parquet|jsonl
  dataset/chunks/examples_chunks.parquet|jsonl
  dataset/chromadb collections: forms_chunks, examples_chunks
  dataset/bm25/bm25_forms_v2.pkl|.meta.pkl
  dataset/bm25/bm25_examples_v2.pkl|.meta.pkl

Usage
-----
  python updateFormsDB.py
  python updateFormsDB.py --form 10
  python updateFormsDB.py --form Form_10 --backup
  python updateFormsDB.py --skip-chroma
  python updateFormsDB.py --allow-download
"""

from __future__ import annotations

import argparse
import gc
import hashlib
import json
import pickle
import re
import shutil
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set, Tuple

import chromadb
import numpy as np
import pandas as pd
import torch
from chromadb.config import Settings
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer

EMBED_MODEL_NAME = "intfloat/multilingual-e5-large-instruct"


def remove_diacritics(text: str) -> str:
    import unicodedata

    nfd = unicodedata.normalize("NFD", text)
    stripped = "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn")
    return stripped.replace("đ", "d").replace("Đ", "D")


def tokenize_for_bm25(text: str, use_bigrams: bool = True) -> List[str]:
    """Same tokenization style as hybrid_retrieval, without importing it."""
    text = remove_diacritics(str(text or "").lower().strip())
    text = re.sub(r"\s+", " ", text)
    all_tokens = re.findall(r"[a-z][a-z0-9]*", text)
    unigrams = [token for token in all_tokens if len(token) >= 2]
    if not use_bigrams:
        return unigrams
    return unigrams + [f"{a}_{b}" for a, b in zip(all_tokens, all_tokens[1:])]


PROJECT_ROOT = Path(__file__).resolve().parent
FORMS_DIR = PROJECT_ROOT / "Forms"
MD_DIR = FORMS_DIR / "md"
EXAMPLES_DIR = FORMS_DIR / "examples"

DATASET_DIR = PROJECT_ROOT / "dataset"
RAW_DIR = DATASET_DIR / "raw"
PROCESSED_DIR = DATASET_DIR / "processed"
CHUNK_DIR = DATASET_DIR / "chunks"
CHROMA_DIR = DATASET_DIR / "chromadb"
BM25_DIR = DATASET_DIR / "bm25"
MODEL_PATH = PROJECT_ROOT / "models" / "embedding"

COLLECTION_NAMES = {
    "forms": "forms_chunks",
    "examples": "examples_chunks",
}

FORMS_META_COLS = [
    "doc_id", "form_id", "form_type", "purpose",
    "required_fields", "split_type", "chunk_index", "total_chunks", "word_count",
]

EXAMPLES_META_COLS = [
    "doc_id", "example_id", "form_id", "form_type",
    "scenario", "fields_json", "split_type", "chunk_index", "total_chunks", "word_count",
]


def normalize_text(text: str) -> str:
    text = str(text or "").replace("\t", " ").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[^\S\n]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def count_words(text: str) -> int:
    return len(str(text or "").split())


def make_chunk_id(doc_id: str, chunk_index: int) -> str:
    return f"{doc_id}__chunk{chunk_index:03d}"


def make_chroma_id(doc_id: str, chunk_index: int, text: str) -> str:
    raw = f"{doc_id}|{chunk_index}|{str(text)[:200]}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def coerce_metadata(meta: Dict) -> Dict:
    clean: Dict = {}
    for key, value in meta.items():
        if value is None:
            continue
        if isinstance(value, (np.integer,)):
            clean[key] = int(value)
        elif isinstance(value, (np.floating,)):
            clean[key] = float(value)
        elif isinstance(value, (np.bool_,)):
            clean[key] = bool(value)
        elif isinstance(value, (list, dict)):
            clean[key] = json.dumps(value, ensure_ascii=False)
        elif isinstance(value, (str, int, float, bool)):
            clean[key] = value
        else:
            clean[key] = str(value)
    return clean


def write_jsonl(records: Iterable[Dict], path: Path) -> None:
    with path.open("w", encoding="utf-8") as f:
        for record in records:
            f.write(json.dumps(to_jsonable(record), ensure_ascii=False) + "\n")


def to_jsonable(value):
    if isinstance(value, dict):
        return {str(k): to_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_jsonable(v) for v in value]
    if isinstance(value, np.ndarray):
        return [to_jsonable(v) for v in value.tolist()]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if pd.isna(value) if not isinstance(value, (list, tuple, dict, np.ndarray)) else False:
        return None
    return value


def maybe_backup(paths: Iterable[Path], enabled: bool) -> None:
    if not enabled:
        return
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = DATASET_DIR / "backups" / f"forms_update_{stamp}"
    backup_dir.mkdir(parents=True, exist_ok=True)
    for path in paths:
        if path.exists():
            target = backup_dir / path.relative_to(DATASET_DIR)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
    print(f"Backup saved: {backup_dir}")


def split_front_matter(text: str) -> Tuple[Dict, str]:
    text = text.lstrip("\ufeff")
    if not text.startswith("---"):
        raise ValueError("missing YAML front matter")
    parts = text.split("---", 2)
    if len(parts) < 3:
        raise ValueError("invalid YAML front matter")
    return parse_simple_yaml(parts[1]), parts[2].strip()


def parse_simple_yaml(src: str) -> Dict:
    """Parse the small front matter shape used by Forms/md without PyYAML."""
    data: Dict[str, object] = {}
    current_key = ""

    for raw_line in src.splitlines():
        line = raw_line.rstrip()
        if not line.strip():
            continue

        list_item = re.match(r"^\s*-\s*(.+?)\s*$", line)
        if list_item and current_key:
            data.setdefault(current_key, [])
            if not isinstance(data[current_key], list):
                data[current_key] = []
            data[current_key].append(_clean_yaml_scalar(list_item.group(1)))
            continue

        if ":" not in line:
            continue

        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        current_key = key

        if value == "":
            data[key] = []
        else:
            data[key] = _clean_yaml_scalar(value)

    return data


def _clean_yaml_scalar(value: str) -> str:
    value = value.strip()
    if (value.startswith('"') and value.endswith('"')) or (
        value.startswith("'") and value.endswith("'")
    ):
        value = value[1:-1]
    return value


def normalize_form_id(value: str) -> str:
    value = str(value or "").strip()
    if not value:
        raise ValueError("form id must not be empty")
    match = re.search(r"(\d+)$", value)
    if not match:
        raise ValueError(f"invalid form id: {value}")
    return f"Form_{int(match.group(1)):02d}"


def parse_form_filter(values: Optional[List[str]]) -> Optional[Set[str]]:
    if not values:
        return None
    selected: Set[str] = set()
    for raw_value in values:
        for item in str(raw_value).split(","):
            item = item.strip()
            if item:
                selected.add(normalize_form_id(item))
    return selected or None


def form_sort_key(form_id: str) -> int:
    match = re.search(r"(\d+)$", str(form_id))
    return int(match.group(1)) if match else 999


def build_forms_dataset(form_ids: Optional[Set[str]] = None) -> Tuple[pd.DataFrame, pd.DataFrame]:
    rows = []
    for path in sorted(MD_DIR.glob("*.md")):
        meta, template = split_front_matter(path.read_text(encoding="utf-8"))
        form_id = str(meta.get("form_id", "")).strip()
        if not form_id:
            raise ValueError(f"{path}: missing form_id")
        form_id = normalize_form_id(form_id)
        if form_ids and form_id not in form_ids:
            continue

        form_type = meta.get("form_type", "")
        if isinstance(form_type, list):
            form_type = ", ".join(str(x) for x in form_type)

        required_fields = meta.get("required_fields", [])
        if isinstance(required_fields, str):
            required_fields = [required_fields]

        rows.append({
            "form_id": form_id,
            "form_type": normalize_text(str(form_type)),
            "purpose": normalize_text(str(meta.get("purpose", ""))),
            "required_fields": [str(x).strip() for x in required_fields if str(x).strip()],
            "template_markdown": normalize_text(template),
        })

    if not rows:
        suffix = f" for {sorted(form_ids)}" if form_ids else ""
        raise FileNotFoundError(f"No markdown forms found in {MD_DIR}{suffix}")

    raw_df = pd.DataFrame(rows).sort_values(
        by="form_id", key=lambda s: s.map(form_sort_key)
    ).reset_index(drop=True)
    processed_df = raw_df.copy()
    processed_df.insert(0, "doc_id", processed_df["form_id"])
    return raw_df, processed_df


def build_examples_dataset(form_ids: Optional[Set[str]] = None) -> Tuple[pd.DataFrame, pd.DataFrame]:
    rows = []
    for path in sorted(EXAMPLES_DIR.glob("output_Form_*.json")):
        file_form_match = re.search(r"Form_(\d+)", path.stem)
        file_form_id = normalize_form_id(file_form_match.group(0)) if file_form_match else ""
        if form_ids and file_form_id not in form_ids:
            continue

        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, list):
            raise ValueError(f"{path}: expected a JSON list")
        for item in payload:
            if not isinstance(item, dict):
                raise ValueError(f"{path}: every example must be an object")
            example_id = str(item.get("example_id", "")).strip()
            if not example_id:
                raise ValueError(f"{path}: example missing example_id")
            form_id = normalize_form_id(item.get("form_id", file_form_id))
            if form_ids and form_id not in form_ids:
                continue
            rows.append({
                "form_id": form_id,
                "form_type": normalize_text(item.get("form_type", "")),
                "example_id": example_id,
                "scenario": normalize_text(item.get("scenario", "")),
                "fields": item.get("fields", {}),
                "filled_content": normalize_text(item.get("filled_content", "")),
                "doc_id": normalize_text(item.get("doc_id", example_id)),
            })

    if not rows:
        suffix = f" for {sorted(form_ids)}" if form_ids else ""
        raise FileNotFoundError(f"No example JSON files found in {EXAMPLES_DIR}{suffix}")

    raw_df = pd.DataFrame(rows).sort_values("example_id").reset_index(drop=True)
    processed_df = pd.DataFrame({
        "doc_id": raw_df["doc_id"],
        "form_id": raw_df["form_id"],
        "form_type": raw_df["form_type"],
        "example_id": raw_df["example_id"],
        "scenario": raw_df["scenario"],
        "fields_json": raw_df["fields"].apply(lambda x: json.dumps(x or {}, ensure_ascii=False)),
        "filled_content": raw_df["filled_content"],
    })
    return raw_df, processed_df


def read_parquet_or_empty(path: Path) -> pd.DataFrame:
    if path.exists():
        return pd.read_parquet(path, engine="pyarrow")
    return pd.DataFrame()


def merge_by_form_id(existing: pd.DataFrame, updates: pd.DataFrame, form_ids: Set[str]) -> pd.DataFrame:
    if existing.empty:
        merged = updates.copy()
    else:
        existing = existing.copy()
        existing["form_id"] = existing["form_id"].apply(normalize_form_id)
        kept = existing[~existing["form_id"].isin(form_ids)]
        merged = pd.concat([kept, updates], ignore_index=True)
    return merged.sort_values(
        by="form_id", key=lambda s: s.map(form_sort_key)
    ).reset_index(drop=True)


def merge_examples_by_form_id(existing: pd.DataFrame, updates: pd.DataFrame, form_ids: Set[str]) -> pd.DataFrame:
    if existing.empty:
        merged = updates.copy()
    else:
        existing = existing.copy()
        existing["form_id"] = existing["form_id"].apply(normalize_form_id)
        kept = existing[~existing["form_id"].isin(form_ids)]
        merged = pd.concat([kept, updates], ignore_index=True)
    return merged.sort_values("example_id").reset_index(drop=True)


def merge_partial_update(
    forms_raw_update: pd.DataFrame,
    forms_processed_update: pd.DataFrame,
    examples_raw_update: pd.DataFrame,
    examples_processed_update: pd.DataFrame,
    form_ids: Set[str],
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    forms_raw = merge_by_form_id(
        read_parquet_or_empty(RAW_DIR / "forms_dataset.parquet"),
        forms_raw_update,
        form_ids,
    )
    forms_processed = merge_by_form_id(
        read_parquet_or_empty(PROCESSED_DIR / "forms_dataset_processed.parquet"),
        forms_processed_update,
        form_ids,
    )
    examples_raw = merge_examples_by_form_id(
        read_parquet_or_empty(RAW_DIR / "forms_examples_dataset.parquet"),
        examples_raw_update,
        form_ids,
    )
    examples_processed = merge_examples_by_form_id(
        read_parquet_or_empty(PROCESSED_DIR / "forms_examples_dataset_processed.parquet"),
        examples_processed_update,
        form_ids,
    )
    return forms_raw, forms_processed, examples_raw, examples_processed


def build_chunks(forms_df: pd.DataFrame, examples_df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    forms_chunks = []
    for _, row in forms_df.iterrows():
        text = str(row.get("template_markdown", "") or "")
        doc_id = str(row["doc_id"])
        forms_chunks.append({
            "chunk_id": make_chunk_id(doc_id, 0),
            "doc_id": doc_id,
            "form_id": str(row.get("form_id", "")),
            "form_type": str(row.get("form_type", "")),
            "purpose": str(row.get("purpose", "")),
            "required_fields": row.get("required_fields", []),
            "chunk_index": 0,
            "total_chunks": 1,
            "split_type": "full_template",
            "text": text,
            "word_count": count_words(text),
        })

    examples_chunks = []
    for _, row in examples_df.iterrows():
        text = str(row.get("filled_content", "") or "")
        doc_id = str(row["doc_id"])
        examples_chunks.append({
            "chunk_id": make_chunk_id(doc_id, 0),
            "doc_id": doc_id,
            "example_id": str(row.get("example_id", "")),
            "form_id": str(row.get("form_id", "")),
            "form_type": str(row.get("form_type", "")),
            "scenario": str(row.get("scenario", "")),
            "fields_json": str(row.get("fields_json", "{}") or "{}"),
            "chunk_index": 0,
            "total_chunks": 1,
            "split_type": "full_example",
            "text": text,
            "word_count": count_words(text),
        })

    return pd.DataFrame(forms_chunks), pd.DataFrame(examples_chunks)


def save_datasets(
    forms_raw: pd.DataFrame,
    forms_processed: pd.DataFrame,
    examples_raw: pd.DataFrame,
    examples_processed: pd.DataFrame,
    forms_chunks: pd.DataFrame,
    examples_chunks: pd.DataFrame,
) -> None:
    for path in (RAW_DIR, PROCESSED_DIR, CHUNK_DIR, BM25_DIR):
        path.mkdir(parents=True, exist_ok=True)

    forms_raw.to_parquet(RAW_DIR / "forms_dataset.parquet", engine="pyarrow", index=False)
    examples_raw.to_parquet(RAW_DIR / "forms_examples_dataset.parquet", engine="pyarrow", index=False)
    forms_processed.to_parquet(PROCESSED_DIR / "forms_dataset_processed.parquet", engine="pyarrow", index=False)
    examples_processed.to_parquet(PROCESSED_DIR / "forms_examples_dataset_processed.parquet", engine="pyarrow", index=False)
    forms_chunks.to_parquet(CHUNK_DIR / "forms_chunks.parquet", engine="pyarrow", index=False)
    examples_chunks.to_parquet(CHUNK_DIR / "examples_chunks.parquet", engine="pyarrow", index=False)
    write_jsonl(forms_chunks.to_dict(orient="records"), CHUNK_DIR / "forms_chunks.jsonl")
    write_jsonl(examples_chunks.to_dict(orient="records"), CHUNK_DIR / "examples_chunks.jsonl")


def get_collection(client: chromadb.PersistentClient, name: str, reset: bool) -> chromadb.Collection:
    if reset:
        try:
            client.delete_collection(name)
            print(f"Deleted collection: {name}")
        except Exception:
            pass
    return client.get_or_create_collection(name=name, metadata={"hnsw:space": "cosine"})


def delete_forms_from_collection(
    client: chromadb.PersistentClient,
    collection_key: str,
    form_ids: Set[str],
) -> int:
    collection = get_collection(client, COLLECTION_NAMES[collection_key], reset=False)
    deleted = 0
    for form_id in sorted(form_ids, key=form_sort_key):
        results = collection.get(where={"form_id": {"$eq": form_id}}, include=[])
        ids = results.get("ids", [])
        if ids:
            collection.delete(ids=ids)
            deleted += len(ids)
        print(f"  {collection.name}: deleted {len(ids)} chunks for {form_id}")
    return deleted


def embed_passages(model: SentenceTransformer, texts: List[str], batch_size: int) -> np.ndarray:
    prefixed = [f"passage: {text}" for text in texts]
    return model.encode(
        prefixed,
        batch_size=batch_size,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=len(texts) > batch_size,
    )


def resolve_cached_model_path() -> str:
    refs_main = MODEL_PATH / "models--intfloat--multilingual-e5-large-instruct" / "refs" / "main"
    if refs_main.exists():
        revision = refs_main.read_text(encoding="utf-8").strip()
        snapshot = refs_main.parent.parent / "snapshots" / revision
        if snapshot.exists():
            return str(snapshot)
    return EMBED_MODEL_NAME


def load_embedding_model(device: str, allow_download: bool) -> SentenceTransformer:
    kwargs = {
        "device": device,
        "cache_folder": str(MODEL_PATH),
        "local_files_only": not allow_download,
    }
    try:
        return SentenceTransformer(EMBED_MODEL_NAME, **kwargs)
    except Exception as exc:
        if allow_download:
            raise
        cached_path = resolve_cached_model_path()
        if cached_path == EMBED_MODEL_NAME:
            raise
        print(f"  Default cache load failed: {exc}")
        print(f"  Retrying from cached snapshot: {cached_path}")
        return SentenceTransformer(cached_path, device=device, local_files_only=True)


def index_collection(
    client: chromadb.PersistentClient,
    model: SentenceTransformer,
    df: pd.DataFrame,
    collection_key: str,
    meta_cols: List[str],
    batch_size: int,
    reset: bool,
) -> int:
    collection = get_collection(client, COLLECTION_NAMES[collection_key], reset=reset)
    df = df[df["text"].notna() & (df["text"].str.strip() != "")].reset_index(drop=True)
    upserted = 0

    for start in range(0, len(df), batch_size):
        batch = df.iloc[start:start + batch_size]
        texts = batch["text"].tolist()
        ids = [
            make_chroma_id(str(row["doc_id"]), int(row["chunk_index"]), str(row["text"]))
            for _, row in batch.iterrows()
        ]
        metadatas = [
            coerce_metadata({col: row.get(col) for col in meta_cols if col in row.index})
            for _, row in batch.iterrows()
        ]
        embeddings = embed_passages(model, texts, batch_size=batch_size)
        collection.upsert(
            ids=ids,
            embeddings=embeddings.tolist(),
            documents=texts,
            metadatas=metadatas,
        )
        upserted += len(batch)
        print(f"  {collection.name}: {upserted}/{len(df)} chunks")

    return upserted


def rebuild_bm25(df: pd.DataFrame, name: str) -> None:
    save_path = BM25_DIR / f"bm25_{name}_v2.pkl"
    meta_path = save_path.with_suffix(".meta.pkl")
    chunk_ids = df["chunk_id"].tolist()
    corpus_tokens = [tokenize_for_bm25(text) for text in df["text"]]
    bm25 = BM25Okapi(corpus_tokens)
    del corpus_tokens
    gc.collect()
    with save_path.open("wb") as f:
        pickle.dump(bm25, f, protocol=pickle.HIGHEST_PROTOCOL)
    with meta_path.open("wb") as f:
        pickle.dump({"chunk_ids": chunk_ids}, f, protocol=pickle.HIGHEST_PROTOCOL)
    print(f"BM25 rebuilt: {save_path.name} ({len(chunk_ids)} docs)")


def print_stats(name: str, df: pd.DataFrame) -> None:
    wc = df["word_count"]
    print(
        f"{name}: {len(df)} chunks | words min/max/mean = "
        f"{int(wc.min())}/{int(wc.max())}/{wc.mean():.1f}"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Update forms/templates/examples from RAG/Forms into parquet, ChromaDB, and BM25."
    )
    parser.add_argument("--skip-chroma", action="store_true", help="Only rebuild parquet/jsonl/BM25; do not update ChromaDB.")
    parser.add_argument("--skip-bm25", action="store_true", help="Do not rebuild BM25 indexes.")
    parser.add_argument("--no-reset", action="store_true", help="Upsert into existing ChromaDB collections without deleting them first.")
    parser.add_argument(
        "--form",
        action="append",
        help="Only update selected form(s), e.g. --form 10, --form Form_10, or --form 9,10.",
    )
    parser.add_argument("--backup", action="store_true", help="Backup existing parquet/jsonl/BM25 files before overwriting.")
    parser.add_argument("--batch-size", type=int, default=64, help="Embedding/upsert batch size.")
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu", help="Embedding device: cpu, cuda, or mps.")
    parser.add_argument("--allow-download", action="store_true", help="Allow SentenceTransformer to download the embedding model if not cached.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    t0 = time.time()
    selected_form_ids = parse_form_filter(args.form)

    overwrite_paths = [
        RAW_DIR / "forms_dataset.parquet",
        RAW_DIR / "forms_examples_dataset.parquet",
        PROCESSED_DIR / "forms_dataset_processed.parquet",
        PROCESSED_DIR / "forms_examples_dataset_processed.parquet",
        CHUNK_DIR / "forms_chunks.parquet",
        CHUNK_DIR / "examples_chunks.parquet",
        CHUNK_DIR / "forms_chunks.jsonl",
        CHUNK_DIR / "examples_chunks.jsonl",
        BM25_DIR / "bm25_forms_v2.pkl",
        BM25_DIR / "bm25_forms_v2.meta.pkl",
        BM25_DIR / "bm25_examples_v2.pkl",
        BM25_DIR / "bm25_examples_v2.meta.pkl",
    ]
    maybe_backup(overwrite_paths, args.backup)

    if selected_form_ids:
        print(f"Building partial update for: {', '.join(sorted(selected_form_ids, key=form_sort_key))}")
    else:
        print("Building datasets from Forms/md and Forms/examples...")

    forms_raw_update, forms_processed_update = build_forms_dataset(selected_form_ids)
    examples_raw_update, examples_processed_update = build_examples_dataset(selected_form_ids)

    if selected_form_ids:
        forms_raw, forms_processed, examples_raw, examples_processed = merge_partial_update(
            forms_raw_update,
            forms_processed_update,
            examples_raw_update,
            examples_processed_update,
            selected_form_ids,
        )
    else:
        forms_raw = forms_raw_update
        forms_processed = forms_processed_update
        examples_raw = examples_raw_update
        examples_processed = examples_processed_update

    forms_chunks, examples_chunks = build_chunks(forms_processed, examples_processed)
    if selected_form_ids:
        index_forms_chunks = forms_chunks[forms_chunks["form_id"].isin(selected_form_ids)].reset_index(drop=True)
        index_examples_chunks = examples_chunks[examples_chunks["form_id"].isin(selected_form_ids)].reset_index(drop=True)
    else:
        index_forms_chunks = forms_chunks
        index_examples_chunks = examples_chunks

    save_datasets(
        forms_raw,
        forms_processed,
        examples_raw,
        examples_processed,
        forms_chunks,
        examples_chunks,
    )
    print_stats("forms", forms_chunks)
    print_stats("examples", examples_chunks)
    if selected_form_ids:
        print_stats("forms selected", index_forms_chunks)
        print_stats("examples selected", index_examples_chunks)

    if not args.skip_chroma:
        print(f"Loading embedding model on {args.device}...")
        model = load_embedding_model(args.device, args.allow_download)
        client = chromadb.PersistentClient(
            path=str(CHROMA_DIR),
            settings=Settings(anonymized_telemetry=False),
        )
        if selected_form_ids:
            print("Updating selected ChromaDB form chunks...")
            delete_forms_from_collection(client, "forms", selected_form_ids)
            delete_forms_from_collection(client, "examples", selected_form_ids)
            index_collection(client, model, index_forms_chunks, "forms", FORMS_META_COLS, args.batch_size, reset=False)
            index_collection(client, model, index_examples_chunks, "examples", EXAMPLES_META_COLS, args.batch_size, reset=False)
        else:
            reset = not args.no_reset
            print("Indexing ChromaDB collections...")
            index_collection(client, model, forms_chunks, "forms", FORMS_META_COLS, args.batch_size, reset)
            index_collection(client, model, examples_chunks, "examples", EXAMPLES_META_COLS, args.batch_size, reset)

    if not args.skip_bm25:
        print("Rebuilding BM25 indexes...")
        rebuild_bm25(forms_chunks, "forms")
        rebuild_bm25(examples_chunks, "examples")

    print(f"Done in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
