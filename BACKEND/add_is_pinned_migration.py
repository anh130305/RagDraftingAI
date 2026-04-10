import sys
import os

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.session import get_engine

def downgrade():
    with get_engine().connect() as conn:
        conn.execute(text("ALTER TABLE chat_sessions DROP COLUMN IF EXISTS is_pinned"))
        conn.commit()
    print("Column is_pinned dropped.")

def upgrade():
    with get_engine().connect() as conn:
        try:
            conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT FALSE;"))
            conn.commit()
            print("Successfully added is_pinned column!")
        except Exception as e:
            if "already exists" in str(e):
                print("Column is_pinned already exists.")
            else:
                print("Error:", e)

if __name__ == "__main__":
    upgrade()
