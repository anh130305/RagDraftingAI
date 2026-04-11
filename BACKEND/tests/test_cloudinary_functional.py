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
    Kịch bản kiểm tra tích hợp cho PDF:
    1. Tải lên một file PDF giả lập.
    2. Xác nhận resource_type là 'raw' và public_id có đuôi tệp.
    3. Kiểm tra tính công khai của URL (phải trả về 200 OK).
    4. Dọn dẹp sau khi kiểm tra.
    """
    dummy_pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Title (Test PDF) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
    mock_file = MockFile("test_verify_pdf.pdf", dummy_pdf_content, "application/pdf")
    _run_cloudinary_test_logic(mock_file, expected_resource_type="raw", expect_extension_in_id=True)

@pytest.mark.order(2)
def test_cloudinary_docx_upload_and_visibility():
    """
    Kịch bản kiểm tra cho DOCX:
    1. Tải lên một file DOCX giả lập.
    2. Xác nhận resource_type là 'raw' và public_id có đuôi tệp.
    3. Kiểm tra tính công khai của URL.
    """
    dummy_docx_content = b"This is a fake docx content"
    mock_file = MockFile("test_verify_doc.docx", dummy_docx_content, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    _run_cloudinary_test_logic(mock_file, expected_resource_type="raw", expect_extension_in_id=True)

@pytest.mark.order(3)
def test_cloudinary_image_upload_and_visibility():
    """
    Kịch bản kiểm tra cho IMAGE:
    1. Tải lên một file ảnh PNG giả lập.
    2. Xác nhận resource_type là 'image' và public_id KHÔNG có đuôi tệp (theo logic backend).
    3. Kiểm tra tính công khai của URL.
    """
    # Một pixel PNG hợp lệ
    dummy_image_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n\x2e\xe4\x00\x00\x00\x00IEND\xaeB`\x82"
    mock_file = MockFile("test_verify_image.png", dummy_image_content, "image/png")
    _run_cloudinary_test_logic(mock_file, expected_resource_type="image", expect_extension_in_id=False)

@pytest.mark.order(4)
def test_cloudinary_download_headers():
    """
    Kịch bản kiểm tra tiêu đề tải về:
    1. Tải lên một file PDF.
    2. Tạo URL download với cờ fl_attachment:<custom_name>.
    3. Kiểm tra Content-Disposition trong header trả về từ Cloudinary.
    """
    dummy_content = b"%PDF-1.4 test download headers"
    mock_file = MockFile("test_header.pdf", dummy_content, "application/pdf")
    
    # 1. Upload
    result = upload_to_cloudinary(
        file=mock_file,
        user_id="test_download",
        session_id="test_session"
    )
    
    public_id = result.get("public_id")
    resource_type = result.get("resource_type")
    original_url = result.get("url")
    
    custom_filename = "Verified_Download_Name"
    # Giả lập cách frontend tạo URL download
    download_url = original_url.replace("/upload/", f"/upload/fl_attachment:{custom_filename}/")
    
    print(f"\n[DEBUG] Original URL: {original_url}")
    print(f"[DEBUG] Download URL: {download_url}")
    
    try:
        # 2. Kiểm tra Header
        response = requests.get(download_url, timeout=15)
        content_disp = response.headers.get("Content-Disposition", "")
        
        print(f"[DEBUG] Content-Disposition: {content_disp}")
        
        assert response.status_code == 200, f"Lỗi tải về: {response.status_code}"
        assert "attachment" in content_disp.lower(), "Thiếu flag attachment trong Content-Disposition"
        assert custom_filename in content_disp, f"Không tìm thấy tên file '{custom_filename}' trong Content-Disposition: {content_disp}"
        
        print(f"[SUCCESS] Download headers verified. Filename correctly set in Content-Disposition.")

    finally:
        if public_id and resource_type:
            cloudinary.uploader.destroy(public_id, resource_type=resource_type)

def _run_cloudinary_test_logic(mock_file, expected_resource_type, expect_extension_in_id):
    """Hàm bổ trợ để chạy logic kiểm tra chung cho các loại file."""
    print(f"\n--- Testing {mock_file.filename} ({mock_file.content_type}) ---")
    
    # Upload
    result = upload_to_cloudinary(
        file=mock_file,
        user_id="test_verify_user",
        session_id="test_verify_session"
    )
    
    public_id = result.get("public_id")
    final_url = result.get("url")
    resource_type = result.get("resource_type")
    
    assert public_id is not None, "Upload thất bại, không có public_id"
    assert final_url is not None, "Upload thất bại, không có URL"
    
    try:
        # Kiểm tra Metadata
        assert resource_type == expected_resource_type, f"Mong đợi '{expected_resource_type}', nhận được '{resource_type}'"
        
        if expect_extension_in_id:
            assert "." in public_id.split("/")[-1], f"Public ID '{public_id}' nên có phần mở rộng"
        else:
            assert "." not in public_id.split("/")[-1], f"Public ID '{public_id}' KHÔNG nên có phần mở rộng"

        # Kiểm tra khả năng truy cập URL
        response = requests.get(final_url, timeout=15)
        assert response.status_code == 200, f"URL không thể truy cập (Mã lỗi: {response.status_code}). X-Cld-Error: {response.headers.get('X-Cld-Error')}"
        
        print(f"[SUCCESS] {mock_file.filename} is accessible at {final_url}")
        
    finally:
        # Dọn dẹp
        if public_id and resource_type:
            cloudinary.uploader.destroy(public_id, resource_type=resource_type)
