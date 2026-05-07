# 📝 Vietnamese Administrative RAG System

Hệ thống hỗ trợ **soạn thảo văn bản hành chính** và **tra cứu pháp luật Việt Nam** ứng dụng kỹ thuật RAG (Retrieval-Augmented Generation). Dự án sử dụng mô hình **Hybrid Retrieval** để đảm bảo tính chính xác tối đa về mặt pháp lý và tuân thủ nghiêm ngặt thể thức văn bản.

### 🌟 Tính năng cốt lõi
* **Soạn thảo thông minh**: Tự động điền dữ liệu vào biểu mẫu dựa trên yêu cầu người dùng.
* **Tra cứu pháp luật**: Trả về câu trả lời Markdown kèm trích dẫn điều khoản cụ thể.
* **Đảm bảo thể thức**: Tuân thủ Nghị định 30/2020/NĐ-CP về công tác văn thư.

---

## 🚀 Hướng dẫn chuẩn bị dữ liệu

### 1. Tải dữ liệu thô (Raw Data)
Truy cập các liên kết trong file `linkData.txt` để tải các thành phần sau:
* **Dataset pháp luật**: `vbpl_crawl_2.csv` (Nguồn: Kaggle).
* **Vector Database**: Thư mục `ChromaDB` đã được index sẵn (Nguồn: Google Drive).

### 2. Pipeline xử lý dữ liệu (Notebooks)
Để hệ thống hoạt động chính xác, hãy chạy các Notebook trong thư mục `notebook/` theo thứ tự sau:

| Thứ tự | Notebook | Chức năng chính |
| :--- | :--- | :--- |
| 1 | `check` | Kiểm tra tính toàn vẹn của dữ liệu thô. |
| 2 | `preprocess` | Làm sạch dữ liệu và chuyển đổi sang định dạng `.parquet` để tối ưu tốc độ. |
| 3 | `obsoleteFilter` | **Quan trọng**: Lọc bỏ các văn bản đã hết hiệu lực pháp luật. |
| 4 | `Filter` | **Quan trọng**: Lọc bỏ các văn bản không cần thiết cho mục tiêu soạn thảo văn bản hành chính nói chung. |
| 5 | `chunking` | Chia nhỏ văn bản thành các đoạn (chunks) phù hợp với Context Window. |
| 6 | `hybrid_retrieval` | Khởi tạo chỉ mục BM25 và kết nối Vector DB. |

---

## 🏗 Cấu trúc Modules

### 🛠 `hybrid_retrieval.py`
Module lõi thực hiện truy hồi thông tin:
* **Cơ chế**: Kết hợp BM25 (Từ khóa) và Dense Search (Ngữ nghĩa) qua thuật toán RRF (Reciprocal Rank Fusion).
* **Tính năng**: Sửa lỗi lệch ID hệ thống và tự động mở rộng ngữ cảnh điều luật (`expand chunk`).

### 📝 `promptTemplates.py`
Quản lý cấu trúc giao tiếp với LLM:
* Định nghĩa System Prompt chuyên biệt cho văn bản hành chính Việt Nam.
* Ép kiểu đầu ra (Output Parsing) về định dạng JSON chuẩn để xử lý hậu kỳ.

### 🔌 `promptApi.py`
Cung cấp giao diện lập trình (API) cho ứng dụng:
* `draft()`: Trình soạn thảo văn bản tự động.
* `legal_qa()`: Hệ thống hỏi đáp pháp luật.
* Hỗ trợ chọn LLM theo request: `17b` mặc định hoặc `70b` cho tác vụ cần lập luận kỹ hơn.

### 🌐 `main.py`
FastAPI service cho production/dev server:
* RAG endpoints: `/api/v1/rag/draft`, `/api/v1/rag/legal_qa`, `/api/v1/rag/legal_qa_stream`.
* DB endpoints: ingest, delete, status và rebuild BM25 thủ công.
* Dùng chung embedding model và ChromaDB client giữa update/retrieve trong cùng process.

### 💻 `generatePrompt.py`
Công cụ dòng lệnh (CLI) để chạy thử nghiệm nhanh các kịch bản soạn thảo.

---

## 🛠 Yêu cầu hệ thống (Requirements)

* **Ngôn ngữ**: Python >= 3.9
* **Thư viện chính**:
    * `rank-bm25`: Xử lý tìm kiếm văn bản truyền thống.
    * `sentence-transformers`: Tạo embedding cho tìm kiếm ngữ nghĩa.
    * `chromadb`: Cơ sở dữ liệu vector.
    * `fastapi` & `uvicorn`: Chạy API service.
    * `groq` & `openai`: Gọi LLM.
    * `pandas`, `pyarrow`, `numpy` & `python-dotenv`: Quản lý dữ liệu và biến môi trường.

---

## 🔐 Cấu hình môi trường (.env)

Hệ thống hỗ trợ chế độ Hybrid giữa Groq (tốc độ cao) và OpenAI (độ chính xác cao):
```env
GROQ_API_KEY=your_groq_key_here
# HOẶC
OPENAI_API_KEY=your_openai_key_here

# Mặc định nếu request không truyền model
LLM_MODEL="meta-llama/llama-4-scout-17b-16e-instruct"
# Tuỳ chọn khác:
# LLM_MODEL="llama-3.3-70b-versatile"
```

Khi gọi API có thể chọn model theo từng request:

```json
{
  "query": "Soạn quyết định bổ nhiệm công chức lãnh đạo, quản lý",
  "extras": "Người được bổ nhiệm: Ông Nguyễn Văn A",
  "model": "17b",
  "call_llm": true
}
```

Giá trị hợp lệ cho `model`: `"17b"`, `"70b"`, hoặc full model id:
`"meta-llama/llama-4-scout-17b-16e-instruct"` / `"llama-3.3-70b-versatile"`.

---

## ▶️ Chạy API service

```bash
cd RAG
uvicorn main:app --host 0.0.0.0 --port 8001
```

Ví dụ gọi legal QA bằng model 70b:

```bash
curl -X POST http://localhost:8001/api/v1/rag/legal_qa \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Điều kiện bổ nhiệm công chức lãnh đạo, quản lý là gì?",
    "legal_top_k": 5,
    "model": "70b",
    "call_llm": true
  }'
```

---
*Lưu ý: Luôn kiểm tra lại hiệu lực văn bản trước khi sử dụng chính thức.*
