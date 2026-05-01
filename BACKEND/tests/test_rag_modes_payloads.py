import asyncio
import pytest
import httpx
from app.services.rag_service import RAGService


class FakeAsyncClient:
    def __init__(self, *, post_response=None):
        self.post_response = post_response
        self.calls = []

    async def post(self, url, json, timeout=None):
        self.calls.append(("post", url, json))
        return self.post_response

    async def aclose(self):
        return None


def _make_service_with_client(fake_client: FakeAsyncClient) -> RAGService:
    service = RAGService()
    original_client = service._client
    service._client = fake_client
    # Clean up original client
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(original_client.aclose())
        else:
            asyncio.run(original_client.aclose())
    except RuntimeError:
        asyncio.run(original_client.aclose())
    return service


def test_qa_mode_payload_mapping():
    """
    Minh họa cách input từ Frontend đi qua Backend và được map thành input cho RAG trong mode QA.
    """
    # 1. INPUT TỪ FRONTEND (User gõ câu hỏi)
    frontend_input = "Trình bày điều kiện cấp giấy phép kinh doanh?"
    frontend_extras = None

    # RAG Mock Output
    rag_mock_response = {
        "status": "ok",
        "mode": "legal_qa",
        "answer": "Điều kiện cấp giấy phép kinh doanh bao gồm...",
        "context": [{"so_hieu": "01/2020/QH14", "content": "..."}],
        "meta": {"legal_sources": ["01/2020/QH14"]},
    }

    request = httpx.Request("POST", "http://test/api/v1/rag/legal_qa")
    response = httpx.Response(status_code=200, request=request, json=rag_mock_response)
    fake_client = FakeAsyncClient(post_response=response)
    service = _make_service_with_client(fake_client)

    # 2. BACKEND XỬ LÝ & GỌI RAG
    result = asyncio.run(service.answer_legal_question(frontend_input, extras=frontend_extras))

    # 3. ĐẦU VÀO THỰC TẾ ĐƯỢC ĐƯA SANG RAG (BỊ TRÌNH BÀY DƯỚI DẠNG PAYLOAD)
    assert len(fake_client.calls) == 1
    method, url, rag_input_payload = fake_client.calls[0]

    assert url.endswith("/api/v1/rag/legal_qa")
    # Đây chính là dữ liệu RAG nhận được:
    assert rag_input_payload == {
        "query": "Trình bày điều kiện cấp giấy phép kinh doanh?",
        "extras": None,
        "call_llm": True,
    }

    # 4. OUTPUT CUỐI CÙNG MÀ USER NHẬN ĐƯỢC
    assert result["status"] == "ok"
    assert result["answer"] == "Điều kiện cấp giấy phép kinh doanh bao gồm..."


def test_draft_mode_payload_mapping():
    """
    Minh họa luồng dữ liệu Payload đối với chế độ Draft (Soạn thảo văn bản).
    """
    # 1. INPUT TỪ FRONTEND (User gõ câu lệnh soạn văn bản)
    frontend_input = "Soạn công văn của Cục Văn thư và Lưu trữ Nhà nước gửi các Bộ về hướng dẫn thi hành Luật Lưu trữ"
    frontend_extras = "Ngày ký: 05/01/2025\nNgười ký: Cục trưởng Đặng Thanh Tùng\nSố CV: 12/VTLT-NV"

    # RAG Mock Output
    rag_mock_response = {
        "status": "ok",
        "mode": "draft",
        "fields": {
            "co_quan_ban_hanh": "CỤC VĂN THƯ VÀ LƯU TRỮ NHÀ NƯỚC",
            "noi_dung": "Thực hiện Luật Lưu trữ...",
        },
        "meta": {"form_id": "Form_02", "form_type": "Công văn"},
    }

    request = httpx.Request("POST", "http://test/api/v1/rag/draft")
    response = httpx.Response(status_code=200, request=request, json=rag_mock_response)
    fake_client = FakeAsyncClient(post_response=response)
    service = _make_service_with_client(fake_client)

    # 2. BACKEND XỬ LÝ & GỌI RAG
    result = asyncio.run(
        service.draft_document(frontend_input, extras=frontend_extras)
    )

    # 3. ĐẦU VÀO THỰC TẾ ĐƯỢC ĐƯA SANG RAG
    assert len(fake_client.calls) == 1
    method, url, rag_input_payload = fake_client.calls[0]

    assert url.endswith("/api/v1/rag/draft")
    # Dữ liệu truyền tới RAG:
    assert rag_input_payload == {
        "query": "Soạn công văn của Cục Văn thư và Lưu trữ Nhà nước gửi các Bộ về hướng dẫn thi hành Luật Lưu trữ",
        "extras": "Ngày ký: 05/01/2025\nNgười ký: Cục trưởng Đặng Thanh Tùng\nSố CV: 12/VTLT-NV",
        "call_llm": True,
    }

    # 4. OUTPUT RAG TRẢ VỀ CHO BACKEND XỬ LÝ TIẾP
    assert result["status"] == "ok"
    assert "fields" in result
    assert result["fields"]["co_quan_ban_hanh"] == "CỤC VĂN THƯ VÀ LƯU TRỮ NHÀ NƯỚC"
