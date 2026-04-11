import io
import requests
import cloudinary
import cloudinary.uploader
import pytest
from app.services.cloudinary_service import upload_to_cloudinary

class MockFile:
    def __init__(self, filename, content, content_type):
        self.filename = filename
        self.file = io.BytesIO(content)
        self.content_type = content_type

@pytest.mark.order(1)
def test_cloudinary_pdf_upload_and_visibility():
    """
    Kịch bản kiểm tra tích hợp:
    1. Tải lên một file PDF giả lập.
    2. Xác nhận resource_type là 'raw' và public_id có đuôi tệp.
    3. Kiểm tra tính công khai của URL (phải trả về 200 OK).
    4. Dọn dẹp sau khi kiểm tra.
    """
    # 1. Chuẩn bị file PDF mẫu
    dummy_pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Title (Test Verification) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
    mock_file = MockFile("test_verify_flow.pdf", dummy_pdf_content, "application/pdf")
    
    # 2. Thực hiện upload qua service của hệ thống
    result = upload_to_cloudinary(
        file=mock_file,
        user_id="test_verify_user",
        session_id="test_verify_session"
    )
    
    public_id = result.get("public_id")
    final_url = result.get("url")
    resource_type = result.get("resource_type")
    
    assert public_id is not None, "Upload thất bại, không có public_id trả về"
    assert final_url is not None, "Upload thất bại, không có URL trả về"
    assert resource_type is not None, "Upload thất bại, không có resource_type trả về"
    
    try:
        # 3. Kiểm tra Metadata
        print(f"\n[DEBUG] Public ID: {public_id}")
        print(f"[DEBUG] Resource Type: {resource_type}")
        print(f"[DEBUG] Final URL: {final_url}")

        # Với PDF, chúng ta mong muốn resource_type là 'raw' để tránh lỗi 401 trên tài khoản bị hạn chế
        assert resource_type == "raw", f"Mong đợi 'raw', nhưng nhận được '{resource_type}'"
        assert public_id.endswith(".pdf"), f"public_id '{public_id}' thiếu phần mở rộng .pdf"
        
        # 4. Kiểm tra khả năng truy cập URL (Public Accessibility)
        # Chúng ta giả lập việc trình duyệt truy cập file
        response = requests.get(final_url, timeout=15)
        
        assert response.status_code == 200, f"URL không thể truy cập (Mã lỗi: {response.status_code}). Lỗi Cloudinary có thể do ACL hoặc URL sai: {response.headers.get('X-Cld-Error')}"
        
        # Kiểm tra Content-Type
        content_type = response.headers.get("Content-Type", "").lower()
        print(f"[DEBUG] Content-Type từ Cloudinary: {content_type}")
        
    finally:
        # 5. Dọn dẹp
        if public_id and resource_type:
            cloudinary.uploader.destroy(public_id, resource_type=resource_type)
