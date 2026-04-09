import os
import pytest
from uuid import uuid4

# ── Patch DATABASE_URL before anything imports session.py ─────
# This must happen before `from app.core.config import settings`
os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.db.session import Base
from app.api.deps import get_db
from app.models.user import User, UserRole
from app.core.security import hash_password

# ── Test engine (SQLite) ─────────────────────────────────────

TEST_DATABASE_URL = "sqlite:///./test.db"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)


@event.listens_for(test_engine, "connect")
def _set_sqlite_pragma(dbapi_conn, connection_record):
    """Enable foreign key enforcement in SQLite (off by default)."""
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=test_engine
)


# ── Fixtures ─────────────────────────────────────────────────

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Create all tables once for the entire test session."""
    import app.db.base  # noqa: F401  – register all models on Base.metadata
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
    # Clean up test DB file
    if os.path.exists("./test.db"):
        os.remove("./test.db")


@pytest.fixture(autouse=True)
def clean_tables():
    """Truncate all tables between tests to ensure isolation."""
    yield
    session = TestSessionLocal()
    try:
        for table in reversed(Base.metadata.sorted_tables):
            session.execute(table.delete())
        session.commit()
    finally:
        session.close()


@pytest.fixture()
def db():
    """Yield a DB session for each test."""
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db):
    """FastAPI TestClient with overridden DB dependency."""
    from app.main import app

    def _override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── Helpers ──────────────────────────────────────────────────

def create_test_user(
    db,
    *,
    username: str = "testuser",
    password: str = "testpass123",
    role: UserRole = UserRole.user,
    department: str = "Engineering",
) -> User:
    """Insert a user directly into the DB and return the ORM object."""
    user = User(
        id=uuid4(),
        username=username,
        password_hash=hash_password(password),
        role=role,
        department=department,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_auth_header(client: TestClient, username: str, password: str) -> dict:
    """Login via the API and return the Authorization header dict."""
    resp = client.post("/api/v1/auth/login", json={
        "username": username,
        "password": password,
    })
    assert resp.status_code == 200, f"Login failed: {resp.json()}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ── Pre-built user fixtures ─────────────────────────────────

@pytest.fixture()
def normal_user(db) -> User:
    return create_test_user(db, username="normaluser", password="normal123")


@pytest.fixture()
def admin_user(db) -> User:
    return create_test_user(
        db, username="adminuser", password="admin123", role=UserRole.admin
    )


@pytest.fixture()
def normal_auth(client, normal_user) -> dict:
    return get_auth_header(client, "normaluser", "normal123")


@pytest.fixture()
def admin_auth(client, admin_user) -> dict:
    return get_auth_header(client, "adminuser", "admin123")
