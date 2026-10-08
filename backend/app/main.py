import collections
import json
import time
from typing import Dict, Deque
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.models import AnalysisResponse
from app.services.gemma_service import gemma_service
from app.services.ollama_service import ollama_service

app = FastAPI(
    title="Lumina Camera Analysis Backend",
    description="Dual-loop AI photography coaching powered by open-weight Gemma 4",
    version="1.0.0",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory sliding window IP rate limiter
ip_request_history: Dict[str, Deque[float]] = collections.defaultdict(collections.deque)


def check_rate_limit(client_ip: str) -> bool:
    now = time.time()
    window_start = now - 60.0
    history = ip_request_history[client_ip]

    # Clean timestamps older than 60 seconds
    while history and history[0] < window_start:
        history.popleft()

    if len(history) >= settings.RATE_LIMIT_PER_MINUTE:
        return False

    history.append(now)
    return True


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "provider": settings.LLM_PROVIDER,
        "model": settings.GEMMA_MODEL_NAME if settings.LLM_PROVIDER == "gemini" else settings.OLLAMA_MODEL,
        "self_hosted": settings.LLM_PROVIDER == "ollama",
    }


@app.get("/api/info")
async def app_info():
    return {
        "app": "Lumina Camera AI Backend",
        "provider": settings.LLM_PROVIDER,
        "gemma_model": settings.GEMMA_MODEL_NAME,
        "ollama_model": settings.OLLAMA_MODEL,
        "rate_limit_per_minute": settings.RATE_LIMIT_PER_MINUTE,
        "max_upload_size_mb": settings.MAX_UPLOAD_SIZE_MB,
        "is_hosted": settings.LLM_PROVIDER == "gemini",
        "has_api_key": bool(settings.GEMINI_API_KEY),
    }


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze_frame(
    request: Request,
    file: UploadFile = File(...),
    mode: str = Form("general"),
    metrics: str = Form("{}"),
):
    # 1. IP Rate Limiting
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Maximum {settings.RATE_LIMIT_PER_MINUTE} requests per minute.",
        )

    # 2. Maximum Upload Size Enforcement
    content = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image size exceeds limit of {settings.MAX_UPLOAD_SIZE_MB}MB.",
        )

    # 3. Parse telemetry metrics
    try:
        metrics_dict = json.loads(metrics) if metrics else {}
    except Exception:
        metrics_dict = {}

    # 4. Route to active LLM Provider
    provider = settings.LLM_PROVIDER.lower()
    if provider == "ollama":
        result = await ollama_service.analyze_frame(content, mode, metrics_dict)
    else:
        result = await gemma_service.analyze_frame(content, mode, metrics_dict)

    return result


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal coaching engine error",
            "message": str(exc),
            "fallback_tip": "Hold steady and frame cleanly",
        },
    )
