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

Kết thúc bằng: "[Tên CQ] trân trọng./." hoặc tương đương.

---

## QUYẾT ĐỊNH (`quyet_dinh`)

**Cấu trúc:**
- Điều 1: Nội dung quyết định chính (bổ nhiệm / phê duyệt / ban hành...).
- Điều 2: Trách nhiệm thi hành (cơ quan, cá nhân liên quan).
- Điều 3: Hiệu lực thi hành (ngày có hiệu lực).

Mỗi điều khoản viết thành một đoạn riêng, bắt đầu bằng **Điều N.**

---

## TỜ TRÌNH (`to_trinh`)

**Cấu trúc:**
1. Căn cứ pháp lý (còn hiệu lực) và thực tiễn.
2. Sự cần thiết / lý do trình.
3. Nội dung đề xuất (phương án, chỉ tiêu, nguồn lực, tiến độ...).
4. Kiến nghị phê duyệt.

Kết thúc: "[Tên CQ] kính trình [Cấp trên] xem xét, phê duyệt./."

---

## BIÊN BẢN (`bien_ban`)

**Cấu trúc:**
1. Thành phần tham dự (chủ trì, thư ký, đại biểu).
2. Nội dung diễn biến / ý kiến các bên.
3. Kết luận / thống nhất / cam kết.
4. Chữ ký các bên (nếu cần).

Ghi theo thứ tự thời gian, khách quan, trung thực.

---

## GIẤY NGHỈ PHÉP (`giay_nghi_phep`)

**Cấu trúc:**
Nêu rõ: họ tên người nghỉ, chức vụ, thời gian nghỉ (từ ngày... đến ngày...),
nơi nghỉ phép, chế độ nghỉ được hưởng.

Văn phong ngắn gọn, đủ ý, không cần căn cứ pháp lý dài.

---

## MẶC ĐỊNH (loại văn bản khác)

Viết đầy đủ văn phong hành chính: căn cứ pháp lý còn hiệu lực (nếu có) →
nội dung chính → cam kết/điều khoản thi hành (nếu có).
Chỉ trích dẫn văn bản pháp lý đã xác nhận còn hiệu lực từ LEGAL_CONTEXT.