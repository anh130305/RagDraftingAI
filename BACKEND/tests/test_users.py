"""
test_users.py – Tests for GET/PUT /users/me
"""

import pytest


class TestGetProfile:
    """GET /api/v1/users/me"""

    def test_get_profile_success(self, client, normal_user, normal_auth):
        resp = client.get("/api/v1/users/me", headers=normal_auth)
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "normaluser"
        assert data["role"] == "user"
        assert data["is_active"] is True

    def test_get_profile_no_auth(self, client):
        resp = client.get("/api/v1/users/me")
        assert resp.status_code == 401

    def test_get_profile_invalid_token(self, client):
        resp = client.get(
            "/api/v1/users/me",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert resp.status_code == 401


class TestUpdateProfile:
    """PUT /api/v1/users/me"""

    def test_update_department(self, client, normal_user, normal_auth):
        resp = client.put(
            "/api/v1/users/me",
            headers=normal_auth,
            json={"department": "Marketing"},
        )
        assert resp.status_code == 200
        assert resp.json()["department"] == "Marketing"

    def test_update_no_auth(self, client):
        resp = client.put(
            "/api/v1/users/me",
            json={"department": "Sales"},
        )
        assert resp.status_code == 401
