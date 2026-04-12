# Tổng hợp các trang chức năng (Functional Pages) - RagDraftingAI

Dưới đây là danh sách các trang chức năng chính trong dự án FRONTEND, được phân loại theo phân hệ người dùng và quản trị.

---

## 1. Phân hệ Người dùng (Client Interface)
Các trang phục vụ trải nghiệm làm việc trực tiếp với AI cho người dùng cuối.

| Tên Trang | Đường dẫn (Route) | Chức năng chính |
| :--- | :--- | :--- |
| **Đăng nhập** | `/login` | Xác thực người dùng, hỗ trợ Google OAuth và tài khoản hệ thống. |
| **Đăng ký** | `/register` | Cho phép đăng ký người dùng mới. |
| **Trang chủ Chat** | `/chat` | Landing page hiển thị các gợi ý sử dụng AI (Bento Grid). |
| **Phòng Chat** | `/chat/:sessionId` | Giao diện hội thoại RAG, xử lý tệp đính kèm (PDF, DOCX) và xem trước tệp. |
| **Cài đặt** | `/settings` | Quản lý hồ sơ cá nhân, đổi định dạng giao diện (Light/Dark). |

---

## 2. Phân hệ Quản trị (Admin Console)
Truy cập qua đường dẫn `/admin`, sử dụng Sidebar để chuyển đổi giữa các tab chức năng.

| Chức năng | Component | Mô tả |
| :--- | :--- | :--- |
| **Bảng điều khiển** | `Dashboard` | Tổng quan các chỉ số hệ thống, biểu đồ sử dụng. |
| **Cơ sở tri thức** | `KnowledgeBase` | Quản lý tài liệu nguồn phục vụ cho hệ thống RAG (Upload/Delete). |
| **Theo dõi AI** | `AIMonitoring` | Giám sát KPI (QoS), latency, lỗi hệ thống và sự hài lòng người dùng. |
| **Lệnh mẫu** | `PromptTemplateConfig` | Thiết kế và quản lý các bản mẫu prompt cho người dùng. |
| **Quản lý người dùng** | `UserManagement` | Liệt kê, chỉnh sửa thông tin và phân quyền người dùng. |
| **Sức khỏe hệ thống** | `SystemHealth` | Theo dõi trạng thái server, uptime và hiệu suất. |
| **Trung tâm trợ giúp** | `HelpCenter` | Các hướng dẫn và tài liệu hỗ trợ dành cho quản trị viên. |
| **Cài đặt hệ thống** | `Settings` | Cấu hình các tham số kỹ thuật cho hệ thống AI. |

---

## 3. Thành phần bổ trợ (Core Components)
*   **UserLayout**: Khung giao diện dùng chung cho phân hệ người dùng.
*   **Sidebar / TopBar**: Thành phần điều hướng chính trong Admin Console.
*   **ChatComposer**: Bộ soạn thảo tin nhắn thông minh hỗ trợ gắn tệp và gợi ý.
*   **Preview Modal**: Bộ xem trước tài liệu đa định dạng tích hợp Cloudinary.
