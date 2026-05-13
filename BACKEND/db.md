```sql

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role    AS ENUM ('admin', 'user', 'moderator');
CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');
CREATE TYPE doc_status   AS ENUM ('pending', 'processing', 'ready', 'failed');
CREATE TYPE audit_action AS ENUM (
    'login', 'logout', 'upload_document', 'delete_document',
    'query', 'create_session', 'delete_session', 'update_user',
    'download_document', 'storage_error',
    'draft_document',
    'create_template', 'update_template', 'delete_template', 'use_template',
    'rag_ingest', 'rag_delete'
);


-- ============================================================
-- FUNCTION dùng chung cho trigger updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 1. USERS
-- ============================================================

CREATE TABLE users (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(50)  UNIQUE NOT NULL,
    email         VARCHAR(255) UNIQUE,
    google_id     VARCHAR(255) UNIQUE,
    password_hash TEXT,
    role          user_role    NOT NULL DEFAULT 'user',
    department    VARCHAR(100),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_username   ON users(username);
CREATE INDEX idx_users_email      ON users(email);
CREATE INDEX idx_users_google_id  ON users(google_id);

CREATE INDEX idx_users_role       ON users(role);
CREATE INDEX idx_users_department ON users(department);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- 2. AUDIT_LOGS
-- ============================================================

CREATE TABLE audit_logs (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID         REFERENCES users(id) ON DELETE SET NULL,
    action        audit_action NOT NULL,
    resource_type VARCHAR(50),
    resource_id   UUID,
    ip_address    VARCHAR(45),
    detail        JSONB,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
    -- Không có updated_at — bảng này chỉ INSERT, không bao giờ UPDATE
);

CREATE INDEX idx_audit_user_id    ON audit_logs(user_id);
CREATE INDEX idx_audit_action     ON audit_logs(action);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_resource   ON audit_logs(resource_type, resource_id);


-- ============================================================
-- 3. CHAT_SESSIONS
-- ============================================================

CREATE TABLE chat_sessions (
    id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT,
    is_archived BOOLEAN   NOT NULL DEFAULT FALSE,
    is_pinned   BOOLEAN   NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id    ON chat_sessions(user_id);
CREATE INDEX idx_sessions_created_at ON chat_sessions(user_id, created_at DESC);

CREATE TRIGGER trg_sessions_updated_at
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- 4. CHAT_MESSAGES
-- ============================================================

CREATE TABLE chat_messages (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID         NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role        message_role NOT NULL,
    content     TEXT         NOT NULL,
    mode        VARCHAR(20),                -- 'qa' hoặc 'generate'
    llm_model   VARCHAR(50),                -- Ví dụ: '17b', '70b'
    feedback    TEXT,                       -- 'like' hoặc 'dislike'
    token_count INTEGER,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_session_id   ON chat_messages(session_id);
CREATE INDEX idx_messages_session_time ON chat_messages(session_id, created_at ASC);


-- ============================================================
-- 5. DOCUMENTS
-- ============================================================

CREATE TABLE documents (
    id                   UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
    title                TEXT       NOT NULL,
    file_path            TEXT       NOT NULL,
    cloudinary_public_id TEXT,
    session_id           UUID       REFERENCES chat_sessions(id) ON DELETE SET NULL,
    file_type            TEXT,
    file_size            BIGINT,
    status               doc_status NOT NULL DEFAULT 'pending',
    uploaded_by          UUID       REFERENCES users(id) ON DELETE SET NULL,
    chunk_count          INTEGER    NOT NULL DEFAULT 0,
    rag_ingested         BOOLEAN    NOT NULL DEFAULT FALSE,
    error_message        TEXT,
    created_at           TIMESTAMP  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_session_id ON documents(session_id);
CREATE INDEX idx_documents_status      ON documents(status);
CREATE INDEX idx_documents_created_at  ON documents(created_at DESC);

CREATE TRIGGER trg_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- 6. QUERY_LOGS  — rút gọn
--    query_text / retrieved_chunk_ids / relevance_scores thuộc RAG service
-- ============================================================

CREATE TABLE query_logs (
    id               UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       UUID      REFERENCES chat_sessions(id) ON DELETE SET NULL,
    message_id       UUID      REFERENCES chat_messages(id) ON DELETE SET NULL,
    response_time_ms INTEGER,
    llm_model        VARCHAR(50),
    chunk_found      BOOLEAN   NOT NULL DEFAULT FALSE,
    is_error         BOOLEAN   NOT NULL DEFAULT FALSE,
    error_message    TEXT,
    created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_query_logs_session_id  ON query_logs(session_id);
CREATE INDEX idx_query_logs_created_at  ON query_logs(created_at DESC);


-- ============================================================
-- 7. PROMPT_TEMPLATES
-- ============================================================

CREATE TABLE prompt_templates (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name               VARCHAR(100) NOT NULL,
    description        TEXT,
    query              TEXT         NOT NULL, -- Trước đây là 'content'
    extra_instructions TEXT,
    mode               VARCHAR(20)  NOT NULL DEFAULT 'qa',
    is_active          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by         UUID         REFERENCES users(id) ON DELETE SET NULL,
    created_at         TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prompt_tpl_active ON prompt_templates(is_active);

CREATE TRIGGER trg_prompt_tpl_updated_at
    BEFORE UPDATE ON prompt_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

```