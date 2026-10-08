import json
import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# Ensure .env is loaded from backend directory
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings:
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "gemini").lower()
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMMA_MODEL_NAME: str = os.getenv("GEMMA_MODEL_NAME", "gemma-4-26b-a4b-it")

    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "gemma4:26b")

    MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "5"))
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))

    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    @property
    def cors_origins(self) -> List[str]:
        raw = os.getenv("CORS_ORIGINS", '["*"]')
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return parsed
            return [str(parsed)]
        except Exception:
            return [x.strip() for x in raw.split(",") if x.strip()]


settings = Settings()
