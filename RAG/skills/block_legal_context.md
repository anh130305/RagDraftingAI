# Skill: Xử lý LEGAL_CONTEXT

## MỤC ĐÍCH
Block này hướng dẫn LLM cách đọc và sử dụng danh sách điều khoản pháp luật
được truy xuất từ RAG trước khi soạn thảo hoặc trả lời.

## TIÊU ĐỀ BLOCK
```
## LEGAL_CONTEXT — Điều khoản pháp luật liên quan
(Thứ bậc hiệu lực: Luật > Pháp lệnh > Nghị định > Nghị quyết)
```

## BƯỚC BẮT BUỘC TRƯỚC KHI SỬ DỤNG
Với mỗi văn bản trong danh sách dưới đây, hãy tự đánh giá hiệu lực pháp lý
(còn hiệu lực / hết hiệu lực / không rõ).
Chỉ trích dẫn những văn bản được đánh giá là CÒN HIỆU LỰC.
Nếu không xác định được, ghi chú "(cần xác minh hiệu lực)" khi trích dẫn.
**Tuyệt đối không bổ sung các văn bản không được LEGAL_CONTEXT cung cấp**

## QUY TẮC ƯU TIÊN
Khi có chồng chéo giữa các điều khoản, ưu tiên theo thứ bậc:
Luật > Pháp lệnh > Nghị định > Nghị quyết.

## Quy tắc ghi căn cứ
Khi ghi 1 điều luật, nghị định vào căn cứ pháp lý cần chuẩn hoá tên của luật , nghị định đó về dạng phù hợp. Ví dụ : LUẬT CÁN BỘ, CÔNG CHỨC -> Luật Cán bộ, công chức. NGHỊ ĐỊNH -> Nghị định
Nếu chắc chắn về nội dung của điều luật ,nghị định, thông tư,... thì hãy ghi thêm 1 đoạn ở phía sau. Ví dụ: Nghị định ... của ... quy định về ...