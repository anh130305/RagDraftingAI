## Các trường hợp kiểm thử OAuth2 Login với Google

---

### ✅ HAPPY PATH — Luồng thành công

| # | Trường hợp | Kết quả mong đợi |
|---|-----------|-----------------|
| O1 | User chưa có tài khoản, đăng nhập Google lần đầu | Tạo tài khoản mới + đăng nhập thành công |
| O2 | User đã có tài khoản Google liên kết, đăng nhập lại | Đăng nhập thành công, không tạo duplicate |
| O3 | User chọn đúng Google account trong popup | Redirect về app với session hợp lệ |
| O4 | User có nhiều Google account, chọn đúng 1 | Đăng nhập đúng account được chọn |

---

### 🚪 LUỒNG POPUP / REDIRECT

| # | Trường hợp | Kết quả mong đợi |
|---|-----------|-----------------|
| P1 | Nhấn nút "Login with Google" → popup mở | Popup Google hiện đúng |
| P2 | User **đóng popup** trước khi chọn account | Không lỗi, quay về trang login bình thường |
| P3 | Popup bị **chặn bởi trình duyệt** (popup blocker) | Hiện thông báo hướng dẫn cho phép popup |
| P4 | User nhấn nút Login Google **nhiều lần liên tiếp** | Không mở nhiều popup, chỉ focus popup hiện có |
| P5 | Dùng **redirect flow** thay popup (mobile) | Redirect đúng, sau khi auth quay lại đúng trang |
| P6 | User nhấn Back trên trang Google auth | Quay về app, không lỗi |
| P7 | Popup mở nhưng user **không làm gì**, để timeout | Xử lý gracefully, không treo UI |

---

### ❌ TRƯỜNG HỢP HỦY / TỪ CHỐI

| # | Trường hợp | Kết quả mong đợi |
|---|-----------|-----------------|
| D1 | User nhấn **"Cancel"** trên màn hình Google consent | Quay về trang login, hiện thông báo nhẹ hoặc im lặng |
| D2 | User **từ chối cấp quyền** (deny permissions) | Báo lỗi rõ ràng, không tạo tài khoản |
| D3 | User thu hồi quyền app trong Google Account Settings | Lần sau login phải xác nhận lại, hoặc báo lỗi |
| D4 | User xóa liên kết app khỏi Google → login lại | Xử lý như lần đầu hoặc báo lỗi tùy luồng |

---

### 🔑 AUTHORIZATION CODE / TOKEN

| # | Trường hợp | Kết quả mong đợi |
|---|-----------|-----------------|
| T1 | Authorization code hợp lệ → exchange lấy token | Access token + refresh token trả về đúng |
| T2 | Authorization code **đã dùng rồi** (replay attack) | Google trả lỗi, app xử lý gracefully |
| T3 | Authorization code **hết hạn** (> 10 phút) | Google trả lỗi `invalid_grant`, app báo lỗi |
| T4 | **Access token hết hạn** giữa session | Dùng refresh token lấy token mới tự động |
| T5 | **Refresh token hết hạn** hoặc bị thu hồi | Force logout + redirect về login |
| T6 | Token bị **giả mạo / tampered** | Xác thực thất bại, từ chối |
| T7 | `id_token` (JWT) không verify được signature | Từ chối, không tạo session |
| T8 | `id_token` có `aud` không khớp Client ID của app | Từ chối |

---

### 🔐 BẢO MẬT — STATE & CSRF

| # | Trường hợp | Kết quả mong đợi |
|---|-----------|-----------------|
| S1 | `state` parameter hợp lệ, khớp khi callback | Tiếp tục luồng bình thường |
| S2 | `state` parameter **không khớp** (CSRF attempt) | Từ chối toàn bộ, không xử lý callback |
| S3 | **Không có** `state` parameter trong callback | Từ chối, báo lỗi bảo mật |
| S4 | Callback URL bị **thay đổi / tampered** | Google từ chối vì redirect_uri không khớp |
| S5 | Dùng **redirect_uri** không đăng ký trong Google Console | Google trả lỗi `redirect_uri_mismatch` |
| S6 | Tấn công **open redirect** qua `state` param | Validate state, không redirect tới URL lạ |

---

### 🌐 LỖI MẠNG / SERVER

| # | Trường hợp | Kết quả mong đợi |
|---|-----------|-----------------|
| N1 | Mất mạng khi đang mở popup Google | Popup báo lỗi mạng, app không treo |
| N2 | Mất mạng khi backend đang exchange code → token | Hiện lỗi, cho phép thử lại |
| N3 | **Google API server down** (503) | Hiện thông báo "Dịch vụ Google không khả dụng" |
| N4 | Backend server down khi nhận callback | Hiện trang lỗi thân thiện |
| N5 | Request exchange token **timeout** | Retry hoặc báo lỗi timeout |
| N6 | Callback nhận được nhưng **backend xử lý lỗi 500** | Hiện thông báo lỗi hệ thống |

---

### 👤 TRƯỜNG HỢP TÀI KHOẢN ĐẶC BIỆT

| # | Trường hợp | Kết quả mong đợi |
|---|-----------|-----------------|
| A1 | Google account **bị suspend bởi Google** | Báo lỗi, không cho đăng nhập |
| A2 | Tài khoản trong app **bị vô hiệu hóa** (banned) | Dù Google auth thành công vẫn báo lỗi |
| A3 | Email Google **trùng với tài khoản username/password** đã có | Hỏi merge account hoặc tự link, không tạo duplicate |
| A4 | User đổi email Google sau khi đã liên kết | Xử lý theo `google_user_id` (sub), không bị mất liên kết |
| A5 | User dùng **Google Workspace** (email công ty) | Cho phép hoặc chặn tùy config |
| A6 | User dùng **tài khoản Google con** (Family Link, <18 tuổi) | Xử lý đúng tùy chính sách app |
| A7 | User có **2 tài khoản app** liên kết 2 Google khác nhau | Không conflict, đăng nhập đúng account |
| A8 | Lần đầu login Google nhưng **thiếu thông tin** (vd: department) | Redirect sang form bổ sung thông tin |

---

### 🔄 SESSION & LOGOUT

| # | Trường hợp | Kết quả mong đợi |
|---|-----------|-----------------|
| SE1 | Đăng nhập Google thành công → session được tạo | Session/cookie hợp lệ, không lưu token ở localStorage |
| SE2 | Logout khỏi app | Xóa session app, **không nhất thiết** logout Google |
| SE3 | Logout khỏi **Google** trong khi vẫn dùng app | Session app vẫn còn đến khi hết hạn (tùy thiết kế) |
| SE4 | Đã login → vào lại trang login | Redirect về trang chính |
| SE5 | Mở app trên **nhiều tab** cùng lúc | Đồng bộ session, không conflict |
| SE6 | Session hết hạn giữa chừng | Silent refresh hoặc redirect login |

---

### 📱 ĐA THIẾT BỊ / TRÌNH DUYỆT

| # | Trường hợp | Kết quả mong đợi |
|---|-----------|-----------------|
| BR1 | Chrome — popup flow | Hoạt động bình thường |
| BR2 | Safari — ITP chặn third-party cookie | Dùng redirect flow thay popup |
| BR3 | Firefox — strict mode | Test popup không bị chặn |
| BR4 | Mobile browser (Chrome/Safari iOS) | Redirect flow, không dùng popup |
| BR5 | Trình duyệt **không hỗ trợ** hoặc quá cũ | Hiện thông báo không hỗ trợ |
| BR6 | **Incognito / Private mode** | Vẫn hoạt động bình thường |
| BR7 | Đăng nhập trên mobile app (WebView) | Dùng đúng flow cho WebView |

---

### ⚙️ CẤU HÌNH / MÔI TRƯỜNG

| # | Trường hợp | Kết quả mong đợi |
|---|-----------|-----------------|
| C1 | `Client ID` sai hoặc không hợp lệ | Google báo lỗi ngay, app xử lý gracefully |
| C2 | `Client Secret` sai (backend) | Exchange token thất bại, báo lỗi |
| C3 | Domain app **không được whitelist** trong Google Console | Google từ chối, báo lỗi rõ |
| C4 | Scopes yêu cầu **không đủ** (thiếu email/profile) | Không lấy được thông tin user |
| C5 | Scopes yêu cầu **quá nhiều** không cần thiết | Google cảnh báo user, ảnh hưởng trust |
| C6 | App ở chế độ **Testing** trong Google Console | Chỉ test users được duyệt mới login được |

---

### 🗺️ GỢI Ý THỨ TỰ TEST

```
1. Happy path (O1 → O4)
2. Luồng popup/redirect (P1 → P7)
3. Hủy / từ chối (D1 → D4)
4. Token & bảo mật (T1 → T8, S1 → S6)
5. Tài khoản đặc biệt (A1 → A8)
6. Lỗi mạng (N1 → N6)
7. Đa trình duyệt (BR1 → BR7)
8. Cấu hình môi trường (C1 → C6)
```

> Bạn muốn mình viết test case cụ thể cho trường hợp nào không? Hoặc generate mock/stub cho Google OAuth flow để test offline?