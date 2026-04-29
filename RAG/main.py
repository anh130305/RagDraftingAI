import asyncio
import logging
import json
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
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
    logger.info("RAG Service started. Models will be initialized.")
    global api
    api = PromptAPI()
    logger.info("RAG Service is ready to handle requests.")


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


@app.post("/api/v1/rag/legal_qa_stream")
def legal_qa_stream(request: LegalQARequest):
    current_api = get_api()

    def event_stream():
        try:
            for event in current_api.legal_qa_stream(
                query=request.query,
                extras=request.extras,
                legal_top_k=request.legal_top_k,
                legal_type_filter=request.legal_type_filter,
                call_llm=request.call_llm,
            ):
                yield json.dumps(event, ensure_ascii=False) + "\n"
        except (asyncio.CancelledError, GeneratorExit):
            logger.info("Legal QA stream cancelled by client disconnect")
            return
        except Exception as e:
            logger.exception(f"Legal QA stream error: {e}")
            yield json.dumps({"type": "error", "error": str(e)}, ensure_ascii=False) + "\n"

    return StreamingResponse(
        event_stream(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)