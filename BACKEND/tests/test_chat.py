"""
test_chat.py – Tests for chat sessions and messages endpoints.

Covers:
  POST   /chat/sessions
  GET    /chat/sessions
  GET    /chat/sessions/{id}
  PUT    /chat/sessions/{id}
  DELETE /chat/sessions/{id}
  GET    /chat/sessions/{id}/messages
  POST   /chat/sessions/{id}/messages
"""

import pytest
from uuid import uuid4


class TestCreateSession:
    """POST /api/v1/chat/sessions"""

    def test_create_session_with_title(self, client, normal_auth):
        resp = client.post(
            "/api/v1/chat/sessions",
            headers=normal_auth,
            json={"title": "My first chat"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "My first chat"
        assert data["is_archived"] is False
        assert "id" in data

    def test_create_session_no_title(self, client, normal_auth):
        resp = client.post(
            "/api/v1/chat/sessions",
            headers=normal_auth,
            json={},
        )
        assert resp.status_code == 201
        assert resp.json()["title"] is None

    def test_create_session_no_auth(self, client):
        resp = client.post("/api/v1/chat/sessions", json={"title": "test"})
        assert resp.status_code == 401


class TestListSessions:
    """GET /api/v1/chat/sessions"""

    def test_list_sessions_empty(self, client, normal_auth):
        resp = client.get("/api/v1/chat/sessions", headers=normal_auth)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_sessions_after_create(self, client, normal_auth):
        # Create 2 sessions
        client.post("/api/v1/chat/sessions", headers=normal_auth, json={"title": "S1"})
        client.post("/api/v1/chat/sessions", headers=normal_auth, json={"title": "S2"})

        resp = client.get("/api/v1/chat/sessions", headers=normal_auth)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 2


class TestGetSession:
    """GET /api/v1/chat/sessions/{id}"""

    def test_get_session_with_messages(self, client, normal_auth):
        # Create a session
        create_resp = client.post(
            "/api/v1/chat/sessions", headers=normal_auth, json={"title": "Detail test"}
        )
        session_id = create_resp.json()["id"]

        resp = client.get(f"/api/v1/chat/sessions/{session_id}", headers=normal_auth)
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Detail test"
        assert "messages" in data
        assert isinstance(data["messages"], list)

    def test_get_session_not_found(self, client, normal_auth):
        fake_id = str(uuid4())
        resp = client.get(f"/api/v1/chat/sessions/{fake_id}", headers=normal_auth)
        assert resp.status_code == 404

    def test_get_other_users_session(self, client, normal_auth, admin_auth):
        # Admin creates a session
        create_resp = client.post(
            "/api/v1/chat/sessions", headers=admin_auth, json={"title": "Admin session"}
        )
        session_id = create_resp.json()["id"]

        # Normal user tries to access it
        resp = client.get(f"/api/v1/chat/sessions/{session_id}", headers=normal_auth)
        assert resp.status_code == 403


class TestUpdateSession:
    """PUT /api/v1/chat/sessions/{id}"""

    def test_update_title(self, client, normal_auth):
        create_resp = client.post(
            "/api/v1/chat/sessions", headers=normal_auth, json={"title": "Old title"}
        )
        session_id = create_resp.json()["id"]

        resp = client.put(
            f"/api/v1/chat/sessions/{session_id}",
            headers=normal_auth,
            json={"title": "New title"},
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "New title"

    def test_archive_session(self, client, normal_auth):
        create_resp = client.post(
            "/api/v1/chat/sessions", headers=normal_auth, json={"title": "Archive me"}
        )
        session_id = create_resp.json()["id"]

        resp = client.put(
            f"/api/v1/chat/sessions/{session_id}",
            headers=normal_auth,
            json={"is_archived": True},
        )
        assert resp.status_code == 200
        assert resp.json()["is_archived"] is True


class TestDeleteSession:
    """DELETE /api/v1/chat/sessions/{id}"""

    def test_delete_session(self, client, normal_auth):
        create_resp = client.post(
            "/api/v1/chat/sessions", headers=normal_auth, json={"title": "Delete me"}
        )
        session_id = create_resp.json()["id"]

        resp = client.delete(f"/api/v1/chat/sessions/{session_id}", headers=normal_auth)
        assert resp.status_code == 204

        # Confirm it's gone
        resp = client.get(f"/api/v1/chat/sessions/{session_id}", headers=normal_auth)
        assert resp.status_code == 404

    def test_delete_other_users_session(self, client, normal_auth, admin_auth):
        create_resp = client.post(
            "/api/v1/chat/sessions", headers=admin_auth, json={"title": "Admin's"}
        )
        session_id = create_resp.json()["id"]

        resp = client.delete(f"/api/v1/chat/sessions/{session_id}", headers=normal_auth)
        assert resp.status_code == 403


class TestMessages:
    """GET/POST /api/v1/chat/sessions/{id}/messages"""

    def _create_session(self, client, auth):
        resp = client.post("/api/v1/chat/sessions", headers=auth, json={"title": "Msg test"})
        return resp.json()["id"]

    def test_send_message(self, client, normal_auth):
        session_id = self._create_session(client, normal_auth)

        resp = client.post(
            f"/api/v1/chat/sessions/{session_id}/messages",
            headers=normal_auth,
            json={"content": "Hello, AI!"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["content"] == "Hello, AI!"
        assert data["role"] == "user"
        assert data["session_id"] == session_id

    def test_get_messages(self, client, normal_auth):
        session_id = self._create_session(client, normal_auth)

        # Send 2 messages
        client.post(
            f"/api/v1/chat/sessions/{session_id}/messages",
            headers=normal_auth,
            json={"content": "First message"},
        )
        client.post(
            f"/api/v1/chat/sessions/{session_id}/messages",
            headers=normal_auth,
            json={"content": "Second message"},
        )

        resp = client.get(
            f"/api/v1/chat/sessions/{session_id}/messages",
            headers=normal_auth,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["content"] == "First message"
        assert data[1]["content"] == "Second message"

    def test_send_message_empty_content(self, client, normal_auth):
        session_id = self._create_session(client, normal_auth)
        resp = client.post(
            f"/api/v1/chat/sessions/{session_id}/messages",
            headers=normal_auth,
            json={"content": ""},
        )
        assert resp.status_code == 422

    def test_messages_other_users_session(self, client, normal_auth, admin_auth):
        session_id = self._create_session(client, admin_auth)

        resp = client.get(
            f"/api/v1/chat/sessions/{session_id}/messages",
            headers=normal_auth,
        )
        assert resp.status_code == 403
