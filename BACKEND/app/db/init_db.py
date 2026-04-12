"""
db.init_db – Database schema initialization and initial seeding.
"""

import logging
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_engine, SessionLocal
from app.models.prompt_template import PromptTemplate

logger = logging.getLogger(__name__)

def ensure_runtime_schema() -> None:
    """Apply safe, idempotent schema fixes for existing deployments."""
    engine = get_engine()
    dialect_name = engine.dialect.name

    with engine.begin() as conn:
        # Fix missing documents index
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_documents_session_id "
                "ON documents (session_id)"
            )
        )
        # Fix missing query_logs columns (is_error, error_message)
        if dialect_name == "sqlite":
            existing_columns = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info('query_logs')")).fetchall()
            }
            if "is_error" not in existing_columns:
                conn.execute(
                    text("ALTER TABLE query_logs ADD COLUMN is_error BOOLEAN DEFAULT 0")
                )
            if "error_message" not in existing_columns:
                conn.execute(
                    text("ALTER TABLE query_logs ADD COLUMN error_message TEXT")
                )
        else:
            conn.execute(
                text(
                    "ALTER TABLE query_logs "
                    "ADD COLUMN IF NOT EXISTS is_error BOOLEAN DEFAULT FALSE"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE query_logs "
                    "ADD COLUMN IF NOT EXISTS error_message TEXT"
                )
            )

    # ALTER TYPE ... ADD VALUE cannot be executed in a transaction block.
    # We use a separate connection with AUTOCOMMIT for these specific changes.
    if dialect_name != "postgresql":
        return

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        for action in ["create_template", "update_template", "delete_template", "use_template"]:
            try:
                # Postgres 9.6+ supports IF NOT EXISTS for ADD VALUE
                conn.execute(text(f"ALTER TYPE audit_action ADD VALUE IF NOT EXISTS '{action}'"))
            except Exception as e:
                # Fallback for older PG or other issues
                logger.warning(f"Could not add {action} to audit_action enum (might already exist): {e}")

def ensure_default_prompt(db: Session) -> None:
    """Create a high-quality default system prompt if the table is empty."""
    try:
        exists = db.query(PromptTemplate).filter(PromptTemplate.is_default == True).first()
        if not exists:
            logger.info("Seeding Master Expert RAG prompt...")
            default_tpl = PromptTemplate(
                name="Trợ lý Chuyên gia RAG (Mặc định)",
                description="Prompt cao cấp tối ưu cho việc phân tích và trích xuất tri thức chính xác.",
                content=(
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
                ),
                is_default=True,
                is_active=True
            )
            db.add(default_tpl)
            db.commit()
    except Exception as e:
        logger.error(f"Error seeding default prompt: {e}")
        db.rollback()

def initialize_system() -> None:
    """Entry point for all startup database maintenance and seeding."""
    logger.info("Initializing system database schema and data...")
    ensure_runtime_schema()
    
    db = SessionLocal()()
    try:
        ensure_default_prompt(db)
    finally:
        db.close()
    
    logger.info("System initialization complete.")
