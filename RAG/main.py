import logging
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import time
import os
from promptApi import PromptAPI

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="RAG Drafting Service", version="1.0.0")

# Global API instance
api: Optional[PromptAPI] = None

class DraftRequest(BaseModel):
    query: str
    extras: Optional[str] = None
    legal_type_filter: Optional[str] = None
    call_llm: bool = True

class LegalQARequest(BaseModel):
    query: str
    extras: Optional[str] = None
    legal_top_k: Optional[int] = None
    legal_type_filter: Optional[str] = None
    call_llm: bool = True

@app.on_event("startup")
async def startup_event():
    # We no longer initialize heavy models here to avoid boot loops on low-RAM systems.
    # Models will be loaded on the first request (Lazy Loading).
    logger.info("RAG Service started. Models will be initialized on first request.")

def get_api():
    global api
    if api is None:
        logger.info("Initializing PromptAPI (Lazy Load)...")
        api = PromptAPI()
        logger.info("PromptAPI initialized successfully.")
    return api

@app.get("/api/v1/rag/health")
async def health_check():
    if api is None:
        return {"status": "ready_to_load", "message": "Service is up, models not yet loaded."}
    return {"status": "ready", "message": "RAG Service is operational."}

@app.post("/api/v1/rag/draft")
async def draft(request: DraftRequest):
    current_api = get_api()
    try:
        result = current_api.draft(

            query=request.query,
            extras=request.extras,
            legal_type_filter=request.legal_type_filter,
            call_llm=request.call_llm
        )
        return result
    except Exception as e:
        logger.error(f"Draft error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/rag/legal_qa")
async def legal_qa(request: LegalQARequest):
    current_api = get_api()
    try:
        result = current_api.legal_qa(
            query=request.query,
            extras=request.extras,
            legal_top_k=request.legal_top_k,
            legal_type_filter=request.legal_type_filter,
            call_llm=request.call_llm
        )
        return result
    except Exception as e:
        logger.error(f"Legal QA error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
