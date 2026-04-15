# Quy trình Truy xuất RAG (RAG Workflow)

Quy trình truy xuất dữ liệu của AI Agent được vận hành theo 3 bước tuần tự, tương ứng với 3 bộ dữ liệu (1 bộ Forms và 2 bộ Data):

### 1. Tìm kiếm Biểu mẫu (Search Forms)
- **Nguồn dữ liệu:** Bộ dữ liệu Biểu mẫu (`Forms Data`).
- **Nhiệm vụ:** Dựa vào yêu cầu (prompt) của người dùng, AI sẽ truy xuất ra biểu mẫu hành chính (chuẩn khung định dạng) phù hợp nhất với loại văn bản muốn soạn thảo (ví dụ: Quyết định, Tờ trình, Thông báo...).

### 2. Tìm kiếm Ví dụ thực tế (Search Examples)
- **Nguồn dữ liệu:** Bộ dữ liệu số 1 (`Ví dụ mẫu`).
- **Nhiệm vụ:** Sau khi xác định được biểu mẫu, hệ thống tiếp tục tìm kiếm các văn bản ví dụ tương đương đã được soạn thảo thành công trong quá khứ. Mục đích để học hỏi cách hành văn, tham khảo từ ngữ và cấu trúc điền thông tin thực tế.

### 3. Tìm kiếm Luật & Quy định (Search Regulations)
- **Nguồn dữ liệu:** Bộ dữ liệu số 2 (`Văn bản Pháp luật`).
- **Nhiệm vụ:** Bước cuối cùng, AI sẽ đối soát các thông tin, điều khoản và nội dung dự kiến soạn thảo với hệ thống luật, nghị định, thông tư hiện hành. Việc này đảm bảo độ chính xác tuyệt đối, tính hợp pháp và đúng quy trình thủ tục pháp lý.
