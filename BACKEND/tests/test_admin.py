"""
test_admin.py – Tests for admin-only endpoints.

Covers:
  GET /admin/users
  PUT /admin/users/{id}
  GET /admin/audit-logs
"""

import pytest
from uuid import uuid4


class TestAdminListUsers:
    """GET /api/v1/admin/users"""

    def test_admin_can_list_users(self, client, admin_auth):
        resp = client.get("/api/v1/admin/users", headers=admin_auth)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1  # At least the admin user exists

    def test_normal_user_forbidden(self, client, normal_auth):
        resp = client.get("/api/v1/admin/users", headers=normal_auth)
        assert resp.status_code == 403

    def test_no_auth(self, client):
        resp = client.get("/api/v1/admin/users")
        assert resp.status_code == 401


class TestAdminUpdateUser:
    """PUT /api/v1/admin/users/{id}"""

    def test_admin_change_role(self, client, admin_auth, normal_user):
        user_id = str(normal_user.id)
        resp = client.put(
            f"/api/v1/admin/users/{user_id}",
            headers=admin_auth,
            json={"role": "moderator"},
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "moderator"

    def test_admin_deactivate_user(self, client, admin_auth, normal_user):
        user_id = str(normal_user.id)
        resp = client.put(
            f"/api/v1/admin/users/{user_id}",
            headers=admin_auth,
            json={"is_active": False},
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

    def test_admin_update_department(self, client, admin_auth, normal_user):
        user_id = str(normal_user.id)
        resp = client.put(
            f"/api/v1/admin/users/{user_id}",
            headers=admin_auth,
            json={"department": "AI Engineer"},
        )
        assert resp.status_code == 200
        assert resp.json()["department"] == "AI Engineer"

    def test_admin_update_nonexistent_user(self, client, admin_auth):
        fake_id = str(uuid4())
        resp = client.put(
            f"/api/v1/admin/users/{fake_id}",
            headers=admin_auth,
            json={"role": "admin"},
        )
        assert resp.status_code == 404

    def test_normal_user_cannot_update(self, client, normal_auth, admin_user):
        user_id = str(admin_user.id)
        resp = client.put(
            f"/api/v1/admin/users/{user_id}",
            headers=normal_auth,
            json={"role": "user"},
        )
        assert resp.status_code == 403


class TestAdminAuditLogs:
    """GET /api/v1/admin/audit-logs"""

    def test_admin_can_get_audit_logs(self, client, admin_auth):
        resp = client.get("/api/v1/admin/audit-logs", headers=admin_auth)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)

    def test_normal_user_forbidden(self, client, normal_auth):
        resp = client.get("/api/v1/admin/audit-logs", headers=normal_auth)
        assert resp.status_code == 403

    def test_audit_logs_with_filters(self, client, admin_auth):
        resp = client.get(
            "/api/v1/admin/audit-logs",
            headers=admin_auth,
            params={"action": "login", "skip": 0, "limit": 10},
        )
        assert resp.status_code == 200
