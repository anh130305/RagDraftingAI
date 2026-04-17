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


def ensure_default_prompt(db: Session) -> None:
    """Đảm bảo có ít nhất một Prompt hệ thống mặc định chất lượng cao."""
    master_name = "Trợ lý Chuyên gia RAG (Mặc định)"
    master_query = (
        "BẠN LÀ MỘT TRỢ LÝ CHUYÊN GIA TRÍ TUỆ NHÂN TẠO CAO CẤP.\n"
        "Nhiệm vụ của bạn là giải quyết yêu cầu của người dùng dựa TRỰC TIẾP và DUY NHẤT trên Ngữ cảnh (Context) được cung cấp dưới đây.\n\n"
        "--- QUY TẮC PHẢN HỒI ---\n"
        "1. TRỰC QUAN: Sử dụng Markdown (bullet points, bold, tables) để thông tin dễ đọc.\n"
        "2. CHÍNH XÁC: Chỉ trả lời dựa trên thông tin trong Context. Nếu Context không đủ thông tin, hãy trả lời: 'Xin lỗi, tôi không tìm thấy thông tin này trong cơ sở tri thức hiện tại.'\n"
        "3. KHÔNG BỊA ĐẶT: Tuyệt đối không tự ý thêm các dữ kiện bên ngoài Context.\n"
        "4. NGÔN NGỮ: Phản hồi bằng ngôn ngữ của người dùng (mặc định là Tiếng Việt).\n\n"
        "--- NGỮ CẢNH (CONTEXT) ---\n"
        "{context}\n\n"
        "--- CÂU HỎI NGƯỜI DÙNG ---\n"
        "{query}\n\n"
        "TRẢ LỜI:"
    )

    try:
        logger.info("Checking for Master Expert RAG prompt...")
        # Tìm kiếm theo tên thay vì chỉ is_default để tránh xung đột
        master_tpl = db.query(PromptTemplate).filter(PromptTemplate.name == master_name).first()
        
        if not master_tpl:
            logger.info(f"Seeding '{master_name}'...")
            new_tpl = PromptTemplate(
                name=master_name,
                description="Prompt cao cấp tối ưu cho việc phân tích và trích xuất tri thức chính xác.",
                query=master_query,
                extra_instructions=None,
                is_active=True
            )
            db.add(new_tpl)
            ok_msg = f"Successfully seeded '{master_name}'."
        else:
            logger.info(f"'{master_name}' already exists. Ensuring it is active.")
            master_tpl.is_active = True
            # Nếu query bị trống (do migration lỗi), cập nhật lại nội dung master
            if not master_tpl.query or master_tpl.query.strip() == "":
                logger.info("Updating existing prompt with Master query content.")
                master_tpl.query = master_query
            ok_msg = f"Successfully verified/updated '{master_name}'."
        
        db.commit()
        logger.info(ok_msg)
    except Exception as e:
        logger.error(f"Error syncing default prompt: {e}")
        db.rollback()

def initialize_system() -> None:
    """Entry point for initial data seeding. Schema is managed by Alembic."""
    logger.info(">>> [SYSTEM INIT] Starting initial data seeding...")

    ensure_audit_action_enum_values()
    
    db = SessionLocal()()
    try:
        ensure_default_prompt(db)
    finally:
        db.close()
    
    logger.info(">>> [SYSTEM INIT] Seeding complete and verified.")
