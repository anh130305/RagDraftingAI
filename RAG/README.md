Đây là bản viết lại file `README.md` của bạn theo phong cách chuyên nghiệp, cấu trúc rõ ràng và tối ưu cho việc trình bày dự án (Portfolio-ready).

---

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

### 💻 `generatePrompt.py`
Công cụ dòng lệnh (CLI) để chạy thử nghiệm nhanh các kịch bản soạn thảo.

---

## 🛠 Yêu cầu hệ thống (Requirements)

* **Ngôn ngữ**: Python >= 3.9
* **Thư viện chính**:
    * `rank-bm25`: Xử lý tìm kiếm văn bản truyền thống.
    * `sentence-transformers`: Tạo embedding cho tìm kiếm ngữ nghĩa.
    * `chromadb`: Cơ sở dữ liệu vector.
    * `pandas` & `python-dotenv`: Quản lý dữ liệu và biến môi trường.

---

## 🔐 Cấu hình môi trường (.env)

Hệ thống hỗ trợ chế độ Hybrid giữa Groq (tốc độ cao) và OpenAI (độ chính xác cao):
```env
GROQ_API_KEY=your_groq_key_here
# HOẶC
OPENAI_API_KEY=your_openai_key_here
```

---
*Lưu ý: Luôn kiểm tra lại hiệu lực văn bản trước khi sử dụng chính thức.*