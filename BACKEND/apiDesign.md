
## 🔐 Auth (2)
| Method | Route | Auth |
|--------|-------|------|
| POST | `/api/v1/auth/register` | — |
| POST | `/api/v1/auth/login` | — |

## 👤 Users (2)
| Method | Route | Auth |
|--------|-------|------|
| GET | `/api/v1/users/me` | User |
| PUT | `/api/v1/users/me` | User |

## 💬 Chat (7)
| Method | Route | Auth |
|--------|-------|------|
| GET | `/api/v1/chat/sessions` | User |
| POST | `/api/v1/chat/sessions` | User |
| GET | `/api/v1/chat/sessions/{id}` | User (owner) |
| PUT | `/api/v1/chat/sessions/{id}` | User (owner) |
| DELETE | `/api/v1/chat/sessions/{id}` | User (owner) |
| GET | `/api/v1/chat/sessions/{id}/messages` | User (owner) |
| POST | `/api/v1/chat/sessions/{id}/messages` | User (owner) |

## 📄 Documents (5)
| Method | Route | Auth |
|--------|-------|------|
| POST | `/api/v1/documents/upload` | User |
| GET | `/api/v1/documents` | User |
| GET | `/api/v1/documents/{id}` | User |
| DELETE | `/api/v1/documents/{id}` | User |
| GET | `/api/v1/documents/{id}/chunks` | User |

## 🤖 RAG / Internal (2) — *mới bổ sung*
| Method | Route | Auth |
|--------|-------|------|
| POST | `/api/v1/internal/rag/callback` | Internal |
| *(tùy thiết kế)* | `/api/v1/internal/...` | Internal |

## 📊 Query Logs (ước tính) — *mới bổ sung*
| Method | Route | Auth |
|--------|-------|------|
| GET | `/api/v1/query-logs` | User |
| GET | `/api/v1/query-logs/{id}` | User |

## 🛡️ Admin (3)
| Method | Route | Auth |
|--------|-------|------|
| GET | `/api/v1/admin/audit-logs` | Admin |
| GET | `/api/v1/admin/users` | Admin |
| PUT | `/api/v1/admin/users/{id}` | Admin |

---
