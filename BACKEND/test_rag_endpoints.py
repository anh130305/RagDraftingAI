import requests
import json

BASE_URL = "http://localhost:8000/api/v1"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmN2VjYTFlYi00YTFhLTRhNDktYTA2ZC0yYzRlM2VjYTUzYjEiLCJleHAiOjE3Nzc3MTcxMzN9.nPTg4-pcvaQoTVqz5ZS_u3AHXeGxCHGQovqBJ_45HuE"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

endpoints = [
    {"method": "GET", "url": "/admin/rag/status", "data": None},
    {"method": "POST", "url": "/admin/rag/check", "data": {"so_hieu": "DOC_TEST_123"}},
    {"method": "POST", "url": "/admin/rag/ingest", "data": {"ocr_text": "test", "manual_so_hieu": "DOC_TEST_123"}},
    {"method": "POST", "url": "/admin/rag/delete-doc", "data": {"so_hieu": "DOC_TEST_123"}},
    {"method": "POST", "url": "/admin/rag/delete-article", "data": {"so_hieu": "DOC_TEST_123", "article_query": "Điều 1"}},
    {"method": "POST", "url": "/admin/rag/rebuild-bm25", "data": None},
]

print("=== RAG ADMIN ENDPOINTS TEST REPORT ===")
for ep in endpoints:
    url = f"{BASE_URL}{ep['url']}"
    try:
        if ep["method"] == "GET":
            resp = requests.get(url, headers=HEADERS)
        else:
            resp = requests.post(url, headers=HEADERS, json=ep["data"])
        
        status = "PASS" if resp.status_code == 200 else f"FAIL ({resp.status_code})"
        print(f"[{status}] {ep['method']} {ep['url']}")
        if resp.status_code != 200:
            print(f"   -> Response: {resp.text}")
    except Exception as e:
        print(f"[ERROR] {ep['method']} {ep['url']}")
        print(f"   -> {e}")

