import asyncio

from app.models.chat_message import ChatMessage, MessageRole
from app.models.query_log import QueryLog
from app.schemas.chat import ChatSessionCreate
from app.services import chat_service
import app.services.rag_service as rag_service_module


def _create_session_id(db, user_id):
    session = chat_service.create_session(db, user_id, ChatSessionCreate(title="RAG QA"))
    return session.id


def _latest_assistant_message(db, session_id):
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id, ChatMessage.role == MessageRole.assistant)
        .order_by(ChatMessage.created_at.desc())
        .first()
    )


def _latest_query_log(db, session_id):
    return (
        db.query(QueryLog)
        .filter(QueryLog.session_id == session_id)
        .order_by(QueryLog.created_at.desc())
        .first()
    )


def test_generate_assistant_response_task_ok_path(db, normal_user, monkeypatch):
    session_id = _create_session_id(db, normal_user.id)

    async def fake_answer_legal_question(query: str, extras=None):
        return {
            "status": "ok",
            "answer": "Tra loi phap ly hop le",
            "meta": {"n_legal_chunks": 2},
        }

    monkeypatch.setattr(
        rag_service_module.rag_service,
        "answer_legal_question",
        fake_answer_legal_question,
    )

    asyncio.run(chat_service.generate_assistant_response_task(session_id, "Cau hoi"))
    db.expire_all()

    assistant = _latest_assistant_message(db, session_id)
    query_log = _latest_query_log(db, session_id)

    assert assistant is not None
    assert assistant.content == "Tra loi phap ly hop le"

    assert query_log is not None
    assert query_log.is_error is False
    assert query_log.chunk_found is True


def test_generate_assistant_response_task_prompt_only_path(db, normal_user, monkeypatch):
    session_id = _create_session_id(db, normal_user.id)

    async def fake_answer_legal_question(query: str, extras=None):
        return {
            "status": "prompt_only",
            "mode": "legal_qa",
            "answer": "",
            "meta": {"messages": [{"role": "system", "content": "..."}]},
        }

    monkeypatch.setattr(
        rag_service_module.rag_service,
        "answer_legal_question",
        fake_answer_legal_question,
    )

    asyncio.run(chat_service.generate_assistant_response_task(session_id, "Cau hoi"))
    db.expire_all()

    assistant = _latest_assistant_message(db, session_id)
    query_log = _latest_query_log(db, session_id)

    assert assistant is not None
    assert "llm" in assistant.content.lower()
    assert "api key/model" in assistant.content.lower()

    assert query_log is not None
    assert query_log.is_error is True
    assert query_log.error_message == "LLM response unavailable (prompt_only)"


def test_generate_assistant_response_task_error_path(db, normal_user, monkeypatch):
    session_id = _create_session_id(db, normal_user.id)

    async def fake_answer_legal_question(query: str, extras=None):
        return {
            "status": "error",
            "mode": "legal_qa",
            "error": "RAG service timeout",
            "meta": {"query": query, "extras": extras},
        }

    monkeypatch.setattr(
        rag_service_module.rag_service,
        "answer_legal_question",
        fake_answer_legal_question,
    )

    asyncio.run(chat_service.generate_assistant_response_task(session_id, "Cau hoi"))
    db.expire_all()

    assistant = _latest_assistant_message(db, session_id)
    query_log = _latest_query_log(db, session_id)

    assert assistant is not None
    assert "rag service timeout" in assistant.content.lower()

    assert query_log is not None
    assert query_log.is_error is True
    assert query_log.error_message == "RAG service timeout"
