# Hướng dẫn sử dụng `promptApi.py`

## Tổng quan

`promptApi.py` là API layer kết nối `hybrid_retrieval` + `promptTemplates`, hỗ trợ hai chế độ:

| Chế độ | Method | Mô tả |
|--------|--------|-------|
| Soạn thảo | `api.draft()` | Soạn văn bản hành chính, trả về dict các fields đã điền |
| Hỏi đáp | `api.legal_qa()` | Hỏi đáp pháp luật, trả về Markdown string |

---

## Cài đặt & Khởi tạo

```bash
# Cài dependencies
pip install groq openai python-dotenv

# Tạo file .env (chọn một trong hai provider)
echo "GROQ_API_KEY=your_key_here"   >> .env
echo "OPENAI_API_KEY=your_key_here" >> .env
```

```python
from promptApi import PromptAPI

# Khởi tạo MỘT LẦN khi start (load model ~20-40s)
api = PromptAPI(
    use_reranker   = True,   # False = nhanh hơn ~3x, ít chính xác hơn (dev mode)
    legal_top_k    = 3,      # số điều luật retrieve
    examples_top_k = 1,      # số ví dụ few-shot
)
```

---

## Tách biệt `query` và `extras`

> **Nguyên tắc quan trọng** :

| Tham số | Vai trò | Ví dụ |
|---------|---------|-------|
| `query` | Yêu cầu chính — nội dung cần soạn / câu hỏi cần trả lời | `"Soạn công văn gửi các Bộ về hướng dẫn Luật Lưu trữ"` |
| `extras` | Thông tin bổ sung — metadata, ràng buộc, ngữ cảnh thêm | `"Ngày ký: 05/01/2025\nNgười ký: Cục trưởng Đặng Thanh Tùng"` |

Bên trong, `extras` được truyền vào `build_messages()` / `build_legal_qa_messages()` và được lưu vào `meta["extras"]` để dễ debug/logging.

---

## `api.draft()` — Soạn thảo văn bản hành chính

### Signature

```python
api.draft(
    query             : str,
    extras            : str | None = None,
    legal_type_filter : str | None = None,
    call_llm          : bool = True,
) -> dict
```

### Ví dụ cơ bản

```python
result = api.draft(
    query  = "Soạn công văn của Cục Văn thư và Lưu trữ Nhà nước gửi các Bộ, "
             "cơ quan ngang Bộ về việc hướng dẫn triển khai thi hành Luật Lưu trữ mới.",
    extras = "Ngày ký: 05/01/2025\n"
             "Người ký: Cục trưởng Đặng Thanh Tùng\n"
             "Số công văn: 12/VTLT-NV",
)

if result["status"] == "ok":
    for field, value in result["fields"].items():
        print(f"{field}: {value}")
```

### Lọc loại văn bản pháp luật

```python
result = api.draft(
    query             = "Soạn quyết định bổ nhiệm công chức",
    extras            = "Ngày ký: 20/01/2025\nNgười ký: Giám đốc - Trần Thị Mai",
    legal_type_filter = "NGHỊ ĐỊNH",   # chỉ retrieve Nghị định
)
```

Các giá trị hợp lệ cho `legal_type_filter`: `"LUẬT"` | `"NGHỊ ĐỊNH"` | `"NGHỊ QUYẾT"` | `"PHÁP LỆNH"`

### Chỉ build prompt, không gọi LLM

```python
result = api.draft(
    query    = "Soạn tờ trình đề nghị ban hành Nghị quyết HĐND",
    extras   = "Ngày trình: 15/03/2025\nSố tờ trình: 18/TTr-UBND",
    call_llm = False,   # chỉ build prompt
)

# Lấy messages thô để tự gọi LLM bên ngoài
messages = result["meta"]["messages"]
```

### Cấu trúc output

```python
# Thành công (status == "ok")
{
    "status": "ok",
    "mode"  : "draft",
    "fields": {
        "CO_QUAN_BAN_HANH" : "Cục Văn thư và Lưu trữ Nhà nước",
        "SO_KY_HIEU"       : "12/VTLT-NV",
        "NGAY_THANG_NAM"   : "ngày 05 tháng 01 năm 2025",
        "NOI_DUNG_CHINH"   : "...",
        # ... các fields khác tuỳ form
    },
    "meta": {
        "query"        : "Soạn công văn...",
        "extras"       : "Ngày ký: 05/01/2025\n...",   # ← thông tin bổ sung đã dùng
        "elapsed_s"    : 4.23,
        "form_id"      : "Form_05",
        "form_type"    : "Công văn",
        "legal_sources": ["30/2020/NĐ-CP", "01/2011/TT-BNV"],
        "context_stats": {"legal": 3, "form": 1, "examples": 1},
    }
}

# Không có LLM (status == "prompt_only")
{
    "status": "prompt_only",
    "mode"  : "draft",
    "fields": {},
    "meta"  : { ..., "messages": [{"role": "system", "content": "..."}, ...] }
}

# Lỗi (status == "error")
{
    "status": "error",
    "mode"  : "draft",
    "error" : "Mô tả lỗi",
    "meta"  : { "query": "...", "extras": "...", "elapsed_s": 0.1 }
}
```

---

## `api.legal_qa()` — Hỏi đáp pháp luật

### Signature

```python
api.legal_qa(
    query             : str,
    extras            : str | None = None,
    legal_top_k       : int | None = None,
    legal_type_filter : str | None = None,
    call_llm          : bool = True,
) -> dict
```

### Ví dụ cơ bản

```python
result = api.legal_qa(
    query  = "Thẩm quyền ký công văn hành chính theo Nghị định 30/2020 là gì?",
    extras = "Chỉ trích dẫn Nghị định 30/2020, không nêu các văn bản khác.",
)

if result["status"] == "ok":
    print(result["answer"])   # Markdown string
```

### Tăng số điều luật retrieve cho câu hỏi phức tạp

```python
result = api.legal_qa(
    query       = "So sánh thủ tục ban hành văn bản quy phạm pháp luật giữa Luật và Nghị định",
    legal_top_k = 8,   # mặc định là 5
)
```

### Cấu trúc output

```python
# Thành công (status == "ok")
{
    "status": "ok",
    "mode"  : "legal_qa",
    "answer": "## Thẩm quyền ký công văn...\n\n...",   # Markdown
    "meta"  : {
        "query"         : "Thẩm quyền ký...",
        "extras"        : "Chỉ trích dẫn...",   # ← ghi chú bổ sung đã dùng
        "elapsed_s"     : 3.1,
        "n_legal_chunks": 5,
        "legal_sources" : ["30/2020/NĐ-CP", "01/2011/TT-BNV"],
    }
}
```

---

## Helpers

### `api.to_json()` — Serialize kết quả thành JSON string

```python
print(api.to_json(result, indent=2))
# Tự động bỏ qua messages thô (meta["messages"]) để tránh output quá lớn
```

### `api.to_markdown()` — Render kết quả thành Markdown

```python
md = api.to_markdown(result)
# draft    → bảng fields + meta
# legal_qa → answer trực tiếp (đã là Markdown)
```

---

## Singleton cho Flask / FastAPI

```python
from promptApi import get_api

# Khởi tạo lần đầu, tái sử dụng các request sau
api = get_api(use_reranker=True, legal_top_k=3, examples_top_k=1)

# FastAPI example
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class DraftRequest(BaseModel):
    query : str
    extras: str = ""

@app.post("/draft")
def draft_endpoint(body: DraftRequest):
    return api.draft(
        query  = body.query,
        extras = body.extras or None,
    )

class QARequest(BaseModel):
    query : str
    extras: str = ""

@app.post("/legal_qa")
def qa_endpoint(body: QARequest):
    return api.legal_qa(
        query  = body.query,
        extras = body.extras or None,
    )
```

---

## CLI Smoke Test

```bash
# Draft với extras
python promptApi.py \
  --mode draft \
  --query "Soạn công văn hướng dẫn Luật Lưu trữ" \
  --extras "Ngày ký: 05/01/2025\nNgười ký: Cục trưởng Đặng Thanh Tùng"

# Legal QA không gọi LLM (chỉ xem prompt)
python promptApi.py \
  --mode legal_qa \
  --query "Điều kiện cấp giấy phép kinh doanh?" \
  --no-llm

# Dev mode — tắt reranker, nhanh hơn ~3x
python promptApi.py --no-reranker
```

---

## Biến môi trường

| Biến | Mô tả | Mặc định |
|------|-------|---------|
| `GROQ_API_KEY` | API key cho Groq (ưu tiên cao nhất) | _(trống)_ |
| `OPENAI_API_KEY` | API key cho OpenAI (fallback) | _(trống)_ |
| `LLM_MODEL` | Tên model ghi đè | `llama-3.3-70b-versatile` (Groq) / `gpt-4o-mini` (OpenAI) |

Nếu không có key nào → API trả `status: "prompt_only"` kèm `meta["messages"]` để caller tự gọi LLM.