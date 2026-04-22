# Skill: Yêu cầu JSON Đầu ra (Soạn thảo)

## MỤC ĐÍCH
Hướng dẫn LLM trả về đúng schema JSON cho chế độ soạn thảo văn bản hành chính.

## TIÊU ĐỀ BLOCK
```
## YÊU CẦU JSON ĐẦU RA
```

## NỘI DUNG HƯỚNG DẪN
Phân tích yêu cầu và trả về JSON theo schema sau.
KHÔNG thêm bất kỳ text nào ngoài JSON:

```json
{
  "fields": {
    "<FIELD_NAME_1>": "...",
    "<FIELD_NAME_2>": "...",
    "<NOI_DUNG_*>": "(nội dung thân văn bản — xem hướng dẫn cấu trúc quy tắc 2)"
  }
}
```

## QUY TẮC BẮT BUỘC

### Quy tắc 1 — Đủ fields
`"fields"` phải chứa TẤT CẢ field đã liệt kê ở FORM_TEMPLATE, bao gồm cả field
NOI_DUNG_*. KHÔNG tạo key nào khác ngoài `"fields"`.

### Quy tắc 2 — Cấu trúc field thân văn bản
Các field NOI_DUNG_* cũng điền trực tiếp vào key `"fields"`.
KHÔNG tạo key riêng ngoài `"fields"` cho các field này.

### Quy tắc 3 — Kiểu dữ liệu
Mỗi value trong `"fields"` là string đơn — không lồng object/array.

### Quy tắc 4 — Không để null
Không để value là null — dùng chuỗi rỗng `""` nếu không có thông tin.

### Quy tắc 5 — Trích dẫn pháp lý trong NOI_DUNG_*
Chỉ được dùng văn bản CÒN HIỆU LỰC từ LEGAL_CONTEXT.
Ưu tiên: Luật > Pháp lệnh > Nghị định > Nghị quyết.

### Quy tắc 6 — JSON hợp lệ
JSON phải hợp lệ (RFC 8259): dấu phẩy và ngoặc kép đúng chuẩn.

## CHECKLIST TỰ KIỂM TRA TRƯỚC KHI TRẢ VỀ
- Đã đánh giá hiệu lực từng văn bản pháp luật trong LEGAL_CONTEXT chưa?
- Có đủ tất cả field (kể cả NOI_DUNG_*) trong `"fields"` chưa?
- Có key nào khác ngoài `"fields"` không? (Nếu có → xóa đi)
- JSON có hợp lệ không?

Nếu chưa đúng → sửa lại trước khi trả về.
Trả về JSON ngay bây giờ: