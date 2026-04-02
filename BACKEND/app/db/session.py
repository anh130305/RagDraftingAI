import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Tìm và load file .env ở thư mục gốc (hoặc ../.env)
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

# Lấy thông tin URL từ môi trường (do Docker Compose định nghĩa)
# Hoặc url fallback khi chạy local không qua docker
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:admin@localhost:5432/rag_db")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency dùng chung cho Fastapi Routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
