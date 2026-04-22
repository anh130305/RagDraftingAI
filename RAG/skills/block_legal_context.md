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

## QUY TẮC ƯU TIÊN
Khi có chồng chéo giữa các điều khoản, ưu tiên theo thứ bậc:
Luật > Pháp lệnh > Nghị định > Nghị quyết.