"""
merge_outputs.py
Gộp tất cả file output_Form_XX.json thành một Parquet
để nạp thẳng vào pipeline.

Chạy: python3 merge_outputs.py
"""

import json
import glob
import pandas as pd
from pathlib import Path

OUTPUT_DIR = "Forms/examples"          # thư mục chứa các file output_Form_XX.json
OUT_PARQUET = "dataset/forms_examples_dataset.parquet"

def load_and_validate(filepath: str) -> list[dict]:
    with open(filepath, encoding="utf-8") as f:
        data = json.load(f)

    errors = []
    for i, item in enumerate(data):
        # Kiểm tra các trường bắt buộc
        for key in ["form_id", "form_type", "example_id", "fields", "filled_content"]:
            if key not in item:
                errors.append(f"  [{filepath}] item #{i} thiếu trường '{key}'")

        # Kiểm tra còn placeholder chưa điền không
        content = item.get("filled_content", "")
        if "{{" in content:
            import re
            remaining = re.findall(r"\{\{[A-Z_]+\}\}", content)
            errors.append(f"  [{filepath}] item #{i} ({item.get('example_id')}) còn placeholder chưa điền: {remaining}")

    if errors:
        print(f"CẢNH BÁO — {filepath}:")
        for e in errors:
            print(e)

    return data

def main():
    files = sorted(glob.glob(f"{OUTPUT_DIR}/output_Form_*.json"))
    if not files:
        print("Không tìm thấy file output_Form_*.json trong thư mục hiện tại.")
        return

    print(f"Tìm thấy {len(files)} file:")
    all_records = []

    for f in files:
        records = load_and_validate(f)
        all_records.extend(records)
        print(f"  {Path(f).name}: {len(records)} ví dụ")

    df = pd.DataFrame(all_records)

    # Thêm doc_id để dùng trong pipeline (khớp với quy ước legal_dataset)
    df["doc_id"] = df["example_id"]

    # Kiểm tra trùng lặp
    dup = df["doc_id"].duplicated().sum()
    if dup:
        print(f"\nCẢNH BÁO: {dup} doc_id bị trùng — kiểm tra lại các file output")
    else:
        print(f"\nTất cả {len(df)} doc_id unique")

    # Lưu Parquet
    Path(OUT_PARQUET).parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUT_PARQUET, engine="pyarrow", index=False)

    print(f"\nĐã lưu: {OUT_PARQUET}")
    print(f"  Tổng ví dụ : {len(df)}")
    print(f"  Phân bố theo form_type:")
    print(df["form_type"].value_counts().to_string())

if __name__ == "__main__":
    main()
