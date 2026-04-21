---
form_id: Form_04
form_type:
  - Chỉ thị
  - Quy chế
  - Quy định
  - Thông cáo
  - Thông báo
  - Hướng dẫn
  - Chương trình
  - Kế hoạch
  - Phương án
  - Đề án
  - Dự án
  - Báo cáo
  - Tờ trình
  - Giấy ủy quyền
  - Phiếu gửi
  - Phiếu chuyển
  - Phiếu báo

purpose: "Văn bản hành chính có tên loại chung"

required_fields:
  - TEN_CQ_CHU_QUAN
  - TEN_CQ_BAN_HANH
  - TEN_LOAI_VAN_BAN
  - SO_VAN_BAN
  - CHU_VIET_TAT_LOAI_VB
  - CHU_VIET_TAT_CQ_BAN_HANH
  - DIA_DANH
  - NGAY
  - THANG
  - NAM
  - TRICH_YEU_NOI_DUNG
  - NOI_DUNG_VAN_BAN
  
---

{{TEN_CQ_CHU_QUAN}}  
**{{TEN_CQ_BAN_HANH}}**

---

Số: {{SO_VAN_BAN}}/{{CHU_VIET_TAT_LOAI_VB}}-

**CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM**  
**Độc lập - Tự do - Hạnh phúc**

---

{{DIA_DANH}}, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}

# {{TEN_LOAI_VAN_BAN}}
**{{TRICH_YEU_NOI_DUNG}}**

{{NOI_DUNG_VAN_BAN}}

---

**Nơi nhận:**

- {{CO_QUAN_NHAN_1}}  
- {{CO_QUAN_NHAN_2}}  
- Lưu: VT, {{CHU_VIET_TAT_DON_VI_SOAN_THAO}} ({{SO_BAN_LUU}})

**{{QUYEN_HAN_CHUC_VU_NGUOI_KY}}**

*(Ký, đóng dấu)*
