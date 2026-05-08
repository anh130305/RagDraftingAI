# Hoàn Thiện Chọn Model 17b/70b Cho Chat, BE/FE, Thống Kê Và Audit

## Summary
Triển khai lựa chọn LLM model theo `apiTutorial.md`: người dùng chọn `17b` hoặc `70b` ở thanh chat, Backend truyền đúng `model` xuống RAG service, lịch sử message hiển thị model đã dùng, Dashboard/AIMonitoring có biểu đồ tỉ lệ dùng model, Audit log ghi rõ model cho từng truy vấn/soạn thảo. Giữ nguyên `mode` hiện tại là nghiệp vụ `qa | generate`; thêm field riêng `llm_model`.

## Key Changes
- Backend API/schema:
  - Thêm `llm_model?: "17b" | "70b"` vào `ChatMessageCreate`, `ChatMessageResponse`, `DraftRequest`.
  - `sendMessage`, `streamMessage`, `generateDraftDocx` nhận `llm_model` và truyền xuống `rag_service`.
  - `rag_service.answer_legal_question`, `stream_legal_question`, `draft_document` gửi JSON `{ model: llm_model }` tới RAG service.
  - Nếu frontend không gửi, default là `"17b"` để khớp `apiTutorial.md`.

- Database persistence:
  - Thêm migration Alembic:
    - `chat_messages.llm_model` nullable string để lịch sử chat hiển thị lại model đã dùng.
    - `query_logs.llm_model` nullable string để thống kê chính xác theo request đã xử lý.
  - Khi lưu user message và assistant message, ghi cùng `llm_model`.
  - Khi tạo `QueryLog`, ghi `llm_model`.

- Audit/statistics:
  - Audit `query` và `draft_document` thêm `detail.llm_model`.
  - `ai_monitoring_service` thêm `model_distribution: Record<string, number>` dựa trên `QueryLog.llm_model`, fallback sang `AuditLog.detail.llm_model` nếu cần.
  - Giữ `mode_distribution` hiện tại cho `qa/generate`; không đổi nghĩa field này.

- Frontend chat UX:
  - Thêm selector model trong `ChatComposer`, đặt gần cụm mic/send như yêu cầu.
  - Default `"17b"`; option `"70b"` cho tác vụ cần lập luận kỹ.
  - `onSend(content, mode, extras, llmModel)` truyền model từ composer lên `Chat.tsx`.
  - `api.sendMessage`, `api.streamMessage`, `api.generateDraftDocx` gửi `llm_model`.
  - Message badge hiển thị cả nghiệp vụ (`Hỏi đáp` / `Soạn thảo`) và model (`17b` / `70b`) cho user/assistant message.

- Dashboard/Admin UI:
  - Cập nhật type `AIMonitoringResponse.summary.model_distribution`.
  - Dashboard thêm hoặc thay block donut riêng: “Phân bổ model LLM” với `17b`, `70b`.
  - AIMonitoring thêm chart/legend model usage, không thay chart feedback hiện có.
  - SystemHealth/Audit table hiển thị `detail.llm_model` trong phần chi tiết audit log.

## Test Plan
- Backend:
  - Test `POST /chat/sessions/{id}/messages` với `llm_model: "70b"` trả message có `llm_model`.
  - Test default không gửi `llm_model` thì lưu `"17b"`.
  - Test stream legal QA truyền model xuống `rag_service.stream_legal_question`.
  - Test draft docx truyền model xuống `rag_service.draft_document`.
  - Test audit detail có `llm_model`.
  - Test AI monitoring trả `model_distribution`.

- Frontend:
  - `npm run lint` và `npm run build`.
  - Kiểm tra gửi QA với `17b` và `70b`: request payload có `llm_model`, badge message hiển thị đúng.
  - Kiểm tra soạn thảo văn bản với `70b`: draft payload có `llm_model`, assistant message hiển thị đúng.
  - Kiểm tra reload session: model badge vẫn hiện từ dữ liệu backend.
  - Kiểm tra Dashboard/AIMonitoring hiển thị donut model usage khi có dữ liệu và trạng thái empty khi chưa có.

## Assumptions
- `mode` tiếp tục chỉ nghĩa nghiệp vụ `qa | generate`; không dùng `mode` để chỉ model.
- Field public thống nhất dùng `llm_model` ở BE/FE; khi gọi RAG service map sang `model`.
- Frontend chỉ cho chọn `"17b"` và `"70b"`; full model id chỉ còn là khả năng nội bộ của RAG service.
- Default là `"17b"` nếu request cũ không truyền model, để tương thích ngược.
