```
RagDraftingAI/
├── BACKEND/
│   ├── app/
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── deps.py                  ← Dependency injection (get_db, get_current_user)
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── router.py            ← Gộp tất cả routes vào 1 chỗ
│   │   │       └── routes/
│   │   │           ├── __init__.py
│   │   │           ├── auth.py          ← POST /auth/register, /auth/login
│   │   │           ├── users.py         ← GET/PUT /users/me
│   │   │           ├── chat.py          ← /chat/sessions, /sessions/{id}/messages
│   │   │           ├── documents.py     ← /documents/upload, list, detail, chunks
│   │   │           ├── admin.py         ← /admin/users, /admin/audit-logs
│   │   │           └── internal.py      ← /internal/documents/{id}/callback  ← RAG service gọi
│   │   │
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py          ← register(), login()
│   │   │   ├── user_service.py          ← get_user(), list_users(), update_profile()
│   │   │   ├── chat_service.py          ← send_message(), list_sessions(), get_history()
│   │   │   ├── document_service.py      ← upload(), list(), delete(), handle_rag_callback()
│   │   │   ├── audit_service.py         ← log_action()
│   │   │   └── rag_client.py            ← HTTP client gọi RAG service  ← quan trọng
│   │   │
│   │   ├── repositories/
│   │   │   ├── __init__.py
│   │   │   ├── base_repo.py             ← Generic: get_by_id, create, update, delete
│   │   │   ├── user_repo.py             ← get_by_username, get_by_role, get_by_department
│   │   │   ├── audit_repo.py            ← append-only, block update/delete
│   │   │   ├── chat_repo.py             ← session CRUD + message CRUD + archive
│   │   │   ├── document_repo.py         ← status lifecycle, bulk chunk insert
│   │   │   └── query_log_repo.py        ← create log, filter by session
│   │   │
│   │   ├── models/                      ← SQLAlchemy ORM models (map 1:1 với schema.sql)
│   │   │   ├── __init__.py
│   │   │   ├── user.py                  ← User, UserRole enum
│   │   │   ├── audit_log.py             ← AuditLog, AuditAction enum
│   │   │   ├── chat_session.py          ← ChatSession
│   │   │   ├── chat_message.py          ← ChatMessage, MessageRole enum
│   │   │   ├── document.py              ← Document, DocStatus enum
│   │   │   ├── document_chunk.py        ← DocumentChunk
│   │   │   └── query_log.py             ← QueryLog
│   │   │
│   │   ├── schemas/                     ← Pydantic DTOs (request / response)
│   │   │   ├── __init__.py
│   │   │   ├── user.py                  ← UserCreate, UserLogin, UserUpdate, UserResponse, Token
│   │   │   ├── chat.py                  ← SessionCreate, MessageCreate, SessionResponse, MessageResponse
│   │   │   ├── document.py              ← DocumentResponse, ChunkResponse, DocumentListResponse
│   │   │   ├── audit.py                 ← AuditLogResponse, AuditFilter
│   │   │   ├── query_log.py             ← QueryLogResponse
│   │   │   └── internal.py              ← RAGCallbackPayload  ← nhận callback từ RAG service
│   │   │
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── config.py                ← Pydantic Settings (đọc .env)
│   │   │   ├── security.py              ← JWT encode/decode, bcrypt hash/verify
│   │   │   └── exceptions.py            ← Custom HTTP exceptions (NotFound, Forbidden...)
│   │   │
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── base.py                  ← Import tất cả models để Alembic nhận diện
│   │   │   └── session.py               ← AsyncSession factory, get_db()
│   │   │
│   │   └── main.py                      ← Khởi tạo FastAPI app, include router, CORS, lifespan
│   │
│   ├── migrations/                      ← Alembic migration files
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │       └── 0001_init_schema.py
│   │
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py                  ← Test DB setup, fixtures
│   │   ├── test_auth.py
│   │   ├── test_chat.py
│   │   └── test_documents.py
│   │
│   ├── .env                             ← Biến môi trường (không commit git)
│   ├── .env.example                     ← Template để teammate biết cần set gì
│   ├── alembic.ini
│   ├── requirements.txt
│   └── Dockerfile
│
├── RAG_SERVICE/                         ← Service riêng biệt (scope khác)
│   └── ...
│
└── docker-compose.yml                   ← PostgreSQL + Qdrant + MinIO + Backend
```

---

Một vài điểm đáng chú ý trong cấu trúc này:

`api/v1/routes/internal.py` là file mới so với walkthrough trước — đây là endpoint nhận callback từ RAG service để cập nhật `status` của document sau khi chunking xong. Thiếu file này thì document sẽ mãi ở trạng thái `processing`.

`services/rag_client.py` đặt trong `services/` thay vì `core/` vì nó là một dependency của `chat_service` và `document_service` — nó có business logic (gọi RAG, parse response), không phải infrastructure thuần túy.

`schemas/internal.py` tách riêng để chứa `RAGCallbackPayload` — giữ schemas của internal API tách khỏi schemas dành cho client bên ngoài, dễ kiểm soát khi thay đổi.

`db/base.py` import tất cả models là bắt buộc để Alembic phát hiện được các bảng khi chạy `alembic revision --autogenerate`.