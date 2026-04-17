from app.db.init_db import ensure_audit_action_enum_values
from app.models.audit_log import AuditAction, AuditLog
from app.services import audit_service


def test_log_action_invalid_resource_uuid_is_ignored(db, normal_user):
    audit_service.log_action(
        user_id=str(normal_user.id),
        action=AuditAction.draft_document,
        resource_type="chat_session",
        resource_id="not-a-valid-uuid",
        detail={"mode": "preview"},
        db=db,
    )

    log = db.query(AuditLog).order_by(AuditLog.created_at.desc()).first()
    assert log is not None
    assert log.user_id == normal_user.id
    assert log.action == AuditAction.draft_document
    assert log.resource_id is None


def test_log_action_unknown_action_is_skipped(db, normal_user):
    before = db.query(AuditLog).count()

    audit_service.log_action(
        user_id=normal_user.id,
        action="unknown_action",
        resource_type="chat_session",
        db=db,
    )

    after = db.query(AuditLog).count()
    assert before == after


def test_log_action_repo_failure_does_not_raise(monkeypatch, db, normal_user):
    def _boom(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(audit_service.audit_repo, "create", _boom)

    audit_service.log_action(
        user_id=normal_user.id,
        action=AuditAction.query,
        resource_type="chat_session",
        db=db,
    )

    assert db.query(AuditLog).count() == 0


def test_ensure_audit_action_enum_values_noop_on_sqlite():
    # SQLite test env should safely skip PostgreSQL enum synchronization.
    ensure_audit_action_enum_values()
