import asyncio

import httpx

from app.services.rag_service import RAGService


class FakeAsyncClient:
    def __init__(self, *, post_response=None, get_response=None):
        self.post_response = post_response
        self.get_response = get_response
        self.calls = []

    async def post(self, url, json):
        self.calls.append(("post", url, json))
        return self.post_response

    async def get(self, url, timeout=None):
        self.calls.append(("get", url, {"timeout": timeout}))
        return self.get_response

    async def aclose(self):
        return None


def _make_service_with_client(fake_client: FakeAsyncClient) -> RAGService:
    service = RAGService()
    original_client = service._client
    service._client = fake_client
    asyncio.run(original_client.aclose())
    return service


def test_answer_legal_question_success_payload_and_endpoint():
    request = httpx.Request("POST", "http://test/api/v1/rag/legal_qa")
    response = httpx.Response(
        status_code=200,
        request=request,
        json={"status": "ok", "answer": "OK", "meta": {"n_legal_chunks": 1}},
    )
    fake_client = FakeAsyncClient(post_response=response)
    service = _make_service_with_client(fake_client)

    result = asyncio.run(service.answer_legal_question("Cau hoi", extras="Them"))

    assert result["status"] == "ok"
    assert fake_client.calls, "Expected one POST call to RAG service"

    method, url, payload = fake_client.calls[0]
    assert method == "post"
    assert url.endswith("/api/v1/rag/legal_qa")
    assert payload == {
        "query": "Cau hoi",
        "extras": "Them",
        "call_llm": True,
    }


def test_answer_legal_question_http_error_extracts_detail():
    request = httpx.Request("POST", "http://test/api/v1/rag/legal_qa")
    response = httpx.Response(
        status_code=500,
        request=request,
        json={
            "detail": {
                "error": {
                    "message": "The model `` does not exist or you do not have access to it.",
                    "code": "model_not_found",
                }
            }
        },
    )
    fake_client = FakeAsyncClient(post_response=response)
    service = _make_service_with_client(fake_client)

    result = asyncio.run(service.answer_legal_question("Cau hoi"))

    assert result["status"] == "error"
    assert result["mode"] == "legal_qa"
    assert result["http_status"] == 500
    assert "model_not_found" in result["error"]


def test_get_health_http_error_returns_structured_payload():
    request = httpx.Request("GET", "http://test/api/v1/rag/health")
    response = httpx.Response(
        status_code=503,
        request=request,
        json={"detail": "Service unavailable"},
    )
    fake_client = FakeAsyncClient(get_response=response)
    service = _make_service_with_client(fake_client)

    result = asyncio.run(service.get_health())

    assert result["status"] == "error"
    assert result["http_status"] == 503
    assert "Service unavailable" in result["message"]
