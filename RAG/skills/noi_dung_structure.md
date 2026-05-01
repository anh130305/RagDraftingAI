# Skill: Cấu trúc Thân Văn bản (NOI_DUNG_*)

## MỤC ĐÍCH
Cung cấp hướng dẫn cấu trúc cụ thể cho từng loại văn bản hành chính khi điền
vào field NOI_DUNG_* trong JSON output.

---

## CÔNG VĂN (`cong_van`)

**Cấu trúc:**
1. Căn cứ pháp lý (nếu có): trích đúng số hiệu từ LEGAL_CONTEXT —
   chỉ trích dẫn văn bản còn hiệu lực.
2. Lý do / mục đích gửi văn bản.
3. Nội dung đề nghị / thông báo / báo cáo cụ thể (số liệu, thời gian, địa điểm...).
4. Đề nghị cơ quan nhận phối hợp / xem xét / giải quyết.


---

## QUYẾT ĐỊNH (`quyet_dinh`)

**Cấu trúc:**
- Điều 1: Nội dung quyết định chính (bổ nhiệm / phê duyệt / ban hành...).
- Điều 2: Trách nhiệm thi hành (cơ quan, cá nhân liên quan).
- Điều 3: Hiệu lực thi hành (ngày có hiệu lực).

Trong form đã có sẵn tiền tố "Điều x." ở trước các field {{NOI_DUNG_DIEU_1}}, {{NOI_DUNG_DIEU_2}}, ... nên trong json trả về đừng ghi lại, ví dụ thay vì ghi "Điều 1. Quy định về ..." thì chỉ cân trả về như sau: "Quy định về ..."

---

## TỜ TRÌNH (`to_trinh`)

**Cấu trúc:**
1. Căn cứ pháp lý (còn hiệu lực) và thực tiễn.
2. Sự cần thiết / lý do trình.
3. Nội dung đề xuất (phương án, chỉ tiêu, nguồn lực, tiến độ...).
4. Kiến nghị phê duyệt.

---

## BIÊN BẢN (`bien_ban`)

**Cấu trúc:**
1. Thành phần tham dự (chủ trì, thư ký, đại biểu).
2. Nội dung diễn biến / ý kiến các bên.
3. Kết luận / thống nhất / cam kết.
4. Chữ ký các bên (nếu cần).

Trình bày các thành viên tham dự theo dạng liệt kê, ngăn cách bởi dấu ";"
Trình bày nội dung diễn biến (NOI_DUNG_DIEN_BIEN) như ví dụ được cung cấp: "NOI_DUNG_DIEN_BIEN": "1. BSCKII Trần Quốc Bảo phát biểu khai mạc, nêu yêu cầu triển khai nhanh các đội tiêm lưu động để hỗ trợ công nhân tại Khu công nghiệp Trà Nóc và Hưng Phú.\n\n2. Khoa Dược ...

Ghi theo thứ tự thời gian, khách quan, trung thực.

---

## GIẤY NGHỈ PHÉP (`giay_nghi_phep`)

**Cấu trúc:**
Nêu rõ: họ tên người nghỉ, chức vụ, thời gian nghỉ (từ ngày... đến ngày...),
nơi nghỉ phép, chế độ nghỉ được hưởng.

Văn phong ngắn gọn, đủ ý, có thể không cần căn cứ pháp lý.

---

## MẶC ĐỊNH (loại văn bản khác)

Viết đầy đủ văn phong hành chính: căn cứ pháp lý còn hiệu lực (nếu có) →
nội dung chính → cam kết/điều khoản thi hành (nếu có).
Chỉ trích dẫn văn bản pháp lý đã xác nhận còn hiệu lực từ LEGAL_CONTEXT.