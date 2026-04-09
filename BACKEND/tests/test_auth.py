"""
test_auth.py – Tests for POST /auth/register and POST /auth/login
"""

import pytest


class TestRegister:
    """POST /api/v1/auth/register"""

    def test_register_success(self, client):
        resp = client.post("/api/v1/auth/register", json={
            "username": "newuser",
            "password": "securepass",
            "department": "HR",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["username"] == "newuser"
        assert data["role"] == "user"
        assert data["department"] == "HR"
        assert data["is_active"] is True
        assert "id" in data

    def test_register_duplicate_username(self, client):
        # First register
        client.post("/api/v1/auth/register", json={
            "username": "dupuser",
            "password": "pass123456",
        })
        # Duplicate
        resp = client.post("/api/v1/auth/register", json={
            "username": "dupuser",
            "password": "another123",
        })
        assert resp.status_code == 409

    def test_register_short_username(self, client):
        resp = client.post("/api/v1/auth/register", json={
            "username": "ab",
            "password": "pass123456",
        })
        assert resp.status_code == 422  # Pydantic validation

    def test_register_short_password(self, client):
        resp = client.post("/api/v1/auth/register", json={
            "username": "validname",
            "password": "12345",
        })
        assert resp.status_code == 422


class TestLogin:
    """POST /api/v1/auth/login"""

    def test_login_success(self, client, normal_user):
        resp = client.post("/api/v1/auth/login", json={
            "username": "normaluser",
            "password": "normal123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client, normal_user):
        resp = client.post("/api/v1/auth/login", json={
            "username": "normaluser",
            "password": "wrongpassword",
        })
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, client):
        resp = client.post("/api/v1/auth/login", json={
            "username": "ghostuser",
            "password": "anything",
        })
        assert resp.status_code == 401
