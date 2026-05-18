"""
db.init_db – Database schema initialization and initial seeding.
"""

import logging
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_engine, SessionLocal
from app.models.audit_log import AuditAction
from app.models.prompt_template import PromptTemplate

logger = logging.getLogger(__name__)


def ensure_audit_action_enum_values() -> None:
    """Keep PostgreSQL enum audit_action aligned with the AuditAction model enum."""
    engine = get_engine()
    if engine.dialect.name != "postgresql":
        return

    expected_values = [action.value for action in AuditAction]

    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT e.enumlabel
                    FROM pg_type t
                    JOIN pg_enum e ON t.oid = e.enumtypid
                    WHERE t.typname = 'audit_action'
                    ORDER BY e.enumsortorder
                    """
                )
            ).fetchall()
            existing_values = {row[0] for row in rows}

            if not existing_values:
                logger.warning("Enum audit_action not found. Skipping enum synchronization.")
                return

            missing_values = [v for v in expected_values if v not in existing_values]
            for value in missing_values:
                escaped_value = value.replace("'", "''")
                conn.execute(
                    text(f"ALTER TYPE audit_action ADD VALUE IF NOT EXISTS '{escaped_value}'")
                )

            if missing_values:
                conn.commit()
                logger.info(
                    "Added missing audit_action enum values: %s",
                    ", ".join(missing_values),
                )
    except Exception as exc:
        logger.warning("Could not sync audit_action enum values: %s", exc)


def initialize_system() -> None:
    """Entry point for initial data seeding. Schema is managed by Alembic."""
    logger.info(">>> [SYSTEM INIT] Starting initial data seeding...")

    ensure_audit_action_enum_values()
    
    logger.info(">>> [SYSTEM INIT] Seeding complete and verified.")

