
# 📂 AI Agent: Hỗ trợ Soạn thảo Văn bản Hành chính (RAG Application)

> **Đề tài:** Quản lý dự án xây dựng AI hỗ trợ soạn thảo văn bản hành chính ứng dụng mô hình RAG.


## 📖 Giới thiệu (Overview)

Dự án này là sự kết hợp giữa hai trụ cột chính: **Quản lý dự án (Project Management)** và **Kỹ thuật công nghệ (Technical Implementation)**. Mục tiêu là xây dựng một trợ lý ảo (AI Agent) có khả năng tự động hóa quy trình soạn thảo văn bản hành chính, đảm bảo đúng thể thức và quy định pháp luật.

Sản phẩm ứng dụng công nghệ **RAG (Retrieval-Augmented Generation)** để truy xuất biểu mẫu và luật, kết hợp với **AI Agent** để tự động điền thông tin và kiểm tra lỗi chính tả.

---

## 🚀 Tính năng chính (Key Features)

Hệ thống hoạt động như một "trợ lý ảo" chủ động thay vì chỉ hỏi-đáp thông thường. Quy trình xử lý bao gồm:

1.  **Nhận diện yêu cầu (Identify):** Phân tích ngôn ngữ tự nhiên để xác định loại văn bản người dùng muốn soạn (Ví dụ: Quyết định khen thưởng).
2.  **Truy xuất dữ liệu (RAG - Retrieve):** Tìm kiếm mẫu văn bản chuẩn và các quy định pháp luật liên quan từ Vector Database.
3.  **Trích xuất & Tự động điền (Extract & Auto-fill):** AI Agent trích xuất thông tin (Tên, số tiền, lý do...) và điền vào biểu mẫu.
4.  **Kiểm tra & Xuất bản (Validation & Generate):** Tự động kiểm tra lỗi chính tả, định dạng và xuất ra file `.docx` hoàn chỉnh.

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

Dự án ưu tiên sử dụng các công nghệ mã nguồn mở và gói miễn phí để tối ưu chi phí.

| Hạng mục | Công nghệ / Công cụ |
| :--- | :--- |
| **Backend Language** | Python (FastAPI/Django) - Ưu tiên cho AI |
| **AI Framework** | LangChain (xử lý RAG), LangGraph hoặc CrewAI (xây dựng Agent) |
| **LLM Model** | OpenAI GPT-4o mini, Google Gemini Pro hoặc Ollama (Llama 3 Local) |
| **Database** | PostgreSQL (User data), ChromaDB/Faiss (Vector DB lưu văn bản mẫu) |
| **Infrastructure** | Render / Vercel / AWS Free Tier |

---

## 📂 Cấu trúc dự án & Tài liệu (Deliverables)

Repository này chứa cả mã nguồn và tài liệu quản lý dự án:

*   `/src`: Mã nguồn Backend và AI Agent.
*   `/docs`: Tài liệu quản lý dự án (PM Documentation).
    *   📜 **Project Charter:** Hồ sơ khởi tạo dự án.
    *   📊 **WBS & Gantt Chart:** Cấu trúc phân chia công việc và tiến độ.
    *   ✅ **Quality Management Plan:** Tiêu chuẩn văn bản hành chính và quy trình kiểm thử (Testing).
    *   💰 **Risk & Cost Report:** Hồ sơ quản lý rủi ro và chi phí.

---

## 🗺️ Lộ trình phát triển (Roadmap)

Dự án được thực hiện trong 12 tuần theo quy trình PMBOK:

*   **Tuần 1 (Initiating):** Xác định Stakeholder, ký Project Charter, chốt Tech Stack.
*   **Tuần 2-3 (Planning):** Lập WBS, Gantt Chart, Kế hoạch quản lý chất lượng và Thiết kế hệ thống.
*   **Tuần 4-6 (Executing - Phase 1):** Xây dựng Vector DB, thu thập 50 mẫu văn bản, Code core RAG.
*   **Tuần 7-9 (Executing - Phase 2):** Phát triển AI Agent (tự điền file), Xây dựng Frontend (MVP).
*   **Tuần 10-11 (M&C):** Kiểm thử (Testing) theo bộ tiêu chí chất lượng, Fix bugs.
*   **Tuần 12 (Closing):** Đóng gói hồ sơ, báo cáo tổng kết và bàn giao sản phẩm.

---

## 👥 Đội ngũ thực hiện (Contributors)

Dự án được thực hiện bởi nhóm 2 thành viên với sự phân chia trách nhiệm rõ ràng:

| Thành viên | Vai trò | Trách nhiệm chính |
| :--- | :--- | :--- |
| **Nguyễn Quang Anh** | Project Manager & QA | Quản lý yêu cầu (Req A), Lập kế hoạch PM, Kiểm thử sản phẩm (QA), Báo cáo. |
| **Cáp Kim Khánh** | Tech Lead / Backend | Quản lý yêu cầu (Req B), Kiến trúc hệ thống, Code AI Agent & Backend API, Tích hợp Database. |

---

## ⚙️ Cài đặt & Chạy thử (Installation)

*(Hướng dẫn dành cho môi trường Dev chạy Local để tối ưu chi phí)*

1.  **Clone dự án:**
    ```bash
    git clone https://github.com/your-username/project-name.git
    cd project-name
    ```

2.  **Cài đặt dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

3.  **Cấu hình môi trường (.env):**
    ```env
    OPENAI_API_KEY=sk-... (hoặc cấu hình URL cho Ollama Local)
    DB_CONNECTION_STRING=...
    ```

4.  **Chạy Vector DB (Local):**
    Khởi chạy ChromaDB hoặc Faiss docker container.

5.  **Khởi động Server:**
    ```bash
    uvicorn main:app --reload
    ```

---

## ⚠️ Quản lý rủi ro (Risk Management)

Dự án áp dụng các biện pháp kiểm soát chi phí và kỹ thuật nghiêm ngặt:
*   **Hard Limit:** Thiết lập giới hạn ngân sách trên Dashboard OpenAI/Google.
*   **Caching:** Lưu trữ đệm các câu hỏi thường gặp để giảm gọi API.
*   **Local Development:** Sử dụng mô hình Open-source (Ollama) trong giai đoạn phát triển.

---
*© 2024 Project Management Course Deliverable.*