from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.session import engine, Base, get_db

app = FastAPI(title="RagDraftingAI API", version="1.0.0")

# Create tables in Database (if they don't exist yet)
Base.metadata.create_all(bind=engine)

# Setup CORS for Frontend React integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root(db: Session = Depends(get_db)):
    try:
        # Execute simple query to test connection
        db.execute(text("SELECT 1"))
        db_status = "Connected successfully to PostgreSQL!"
    except Exception as e:
        db_status = f"Failed to connect: {str(e)}"
        
    return {
        "message": "Welcome to RagDraftingAI Backend REST API",
        "database_status": db_status
    }
