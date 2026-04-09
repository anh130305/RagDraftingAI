## Các trường hợp kiểm thử Auth (Login & Register)

---

### 🔐 ĐĂNG NHẬP (Login) — Username + Password

#### ✅ Happy Path
| # | Trường hợp | Kết quả mong đợi |
|---|-----------|-----------------|
| L1 | Username & password đúng | Đăng nhập thành công, redirect |
| L2 | Username có chữ hoa/thường lẫn lộn (nếu case-insensitive) | Đăng nhập thành công |

#### ❌ Validation — Để trống
| # | Trường hợp | Kết quả mong đợi |
|---|-----------|-----------------|
| L3 | Để trống cả 2 trường | Hiện lỗi cả 2 field |
| L4 | Để trống username | Hiện lỗi username required |
| L5 | Để trống password | Hiện lỗi password required |

#### ❌ Sai thông tin
| # | Trường hợp | Kết quả mong đợi |
|---|-----------|-----------------|
| L6 | Username đúng, password sai | "Sai mật khẩu" hoặc thông báo chung |
| L7 | Username không tồn tại | "Tài khoản không tồn tại" hoặc thông báo chung |
| L8 | Cả 2 đều sai | Thông báo lỗi chung (không lộ thông tin) |
| L9 | Password đúng nhưng username sai case (nếu case-sensitive) | Báo lỗi |

#### ⚠️ Edge Cases
| # | Trường hợp | Kết quả mong đợi |
|---|-----------|-----------------|
| L10 | Username/password có khoảng trắng đầu/cuối | Trim hoặc báo lỗi rõ ràng |
| L11 | Password có ký tự đặc biệt `!@#$%^&*` | Xử lý đúng, không crash |
| L12 | Username/password quá dài (>255 ký tự) | Báo lỗi hoặc truncate |
| L13 | Nhập SQL Injection: `' OR '1'='1` | Không bị bypass, trả lỗi |
| L14 | Nhập XSS: `<script>alert(1)</script>` | Escape, không execute | 
| L15 | Spam click nút Login nhiều lần | Không gửi request trùng, disable button |
| L16 | Mạng chậm / timeout | Hiện loading, thông báo lỗi mạng |
| L17 | Server trả về lỗi 500 | Hiện thông báo lỗi hệ thống |

#### 🔒 Bảo mật
| # | Trường hợp | Kết quả mong đợi |
|---|-----------|-----------------|
| L18 | Đăng nhập sai nhiều lần liên tiếp (brute force) | Khóa tài khoản tạm / captcha |
| L19 | Password hiển thị dưới dạng `••••` | Không lộ plain text |
| L20 | Toggle show/hide password | Hoạt động đúng |
| L21 | Token/session được lưu đúng chỗ | Không lưu plain password ở localStorage |

---

### 📝 ĐĂNG KÝ (Register) — Username + Department + Password + Confirm Password

#### ✅ Happy Path
| # | Trường hợp | Kết quả mong đợi |
|---|-----------|-----------------|
| R1 | Điền đầy đủ, hợp lệ, password khớp | Tạo tài khoản thành công |
| R2 | Đăng ký xong tự động login hoặc redirect login | Luồng đúng theo thiết kế |

#### ❌ Validation — Để trống
| # | Trường hợp | Kết quả mong đợi |
|---|-----------|-----------------|
| R3 | Để trống tất cả | Hiện lỗi tất cả field |
| R4 | Để trống username | Lỗi username required |
| R5 | Để trống department | Lỗi department required |
| R6 | Để trống password | Lỗi password required |
| R7 | Để trống confirm password | Lỗi confirm required |

#### ❌ Username
| # | Trường hợp | Kết quả mong đợi |
|---|-----------|-----------------|
| R8 | Username đã tồn tại trong hệ thống | "Username đã được sử dụng" |
| R9 | Username quá ngắn (< min length, vd: <3 ký tự) | Báo lỗi min length |
| R10 | Username quá dài (> max length) | Báo lỗi max length |
| R11 | Username chứa ký tự đặc biệt không hợp lệ | Báo lỗi format |
| R12 | Username chỉ có khoảng trắng | Trim → báo lỗi required |
| R13 | Username có khoảng trắng ở giữa | Tùy rule: cho phép hay không |

#### ❌ Department
| # | Trường hợp | Kết quả mong đợi |
|---|-----------|-----------------|
| R14 | Không chọn department (nếu là dropdown) | Báo lỗi required |
| R15 | Department không hợp lệ (giá trị lạ, nếu free text) | Báo lỗi |

#### ❌ Password
| # | Trường hợp | Kết quả mong đợi |
|---|-----------|-----------------|
| R16 | Password quá ngắn (< min length) | Báo lỗi min length |
| R17 | Password quá dài (> max length) | Báo lỗi |
| R18 | Password không đủ độ phức tạp (nếu có rule) | Báo lỗi rule cụ thể |
| R19 | Password có khoảng trắng (đầu/cuối/giữa) | Tùy rule: trim hay báo lỗi |
| R20 | Password có ký tự đặc biệt hợp lệ | Chấp nhận bình thường |

#### ❌ Confirm Password
| # | Trường hợp | Kết quả mong đợi |
|---|-----------|-----------------|
| R21 | Confirm password **không khớp** password | "Mật khẩu xác thực không khớp" |
| R22 | Confirm password **khớp** password | Hợp lệ |
| R23 | Thay đổi password sau khi điền confirm | Re-validate confirm field |

#### ⚠️ Edge Cases
| # | Trường hợp | Kết quả mong đợi |
|---|-----------|-----------------|
| R24 | SQL Injection ở bất kỳ field nào | Không bị exploit |
| R25 | XSS ở username / department | Escape đúng |
| R26 | Spam click nút Register | Không tạo duplicate, disable button |
| R27 | Submit form bằng phím Enter | Hoạt động đúng |
| R28 | Mạng chậm / timeout | Hiện loading, thông báo lỗi |
| R29 | Server lỗi 500 khi submit | Hiện thông báo lỗi hệ thống |
| R30 | Paste vào confirm password field | Cho phép hoặc chặn tùy UX |

---

### 🔄 LUỒNG CHUNG
| # | Trường hợp | Kết quả mong đợi |
|---|-----------|-----------------|
| G1 | Đã đăng nhập → vào trang login/register | Redirect về trang chính |
| G2 | Chưa đăng nhập → vào trang cần auth | Redirect về login |
| G3 | Token hết hạn giữa chừng | Logout + redirect login |
| G4 | Nhấn Back sau khi đăng nhập | Không quay về trang login |
| G5 | Đăng nhập trên nhiều tab cùng lúc | Xử lý đồng bộ session |

---

> **Gợi ý thứ tự test:** Happy path → Để trống → Sai dữ liệu → Edge cases → Bảo mật. Bạn muốn mình generate test case dạng code (Jest, Cypress, Playwright...) không?