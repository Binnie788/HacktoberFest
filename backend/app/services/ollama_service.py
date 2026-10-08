import base64
import time
from typing import Any, Dict
import httpx
from app.config import settings
from app.models import AnalysisResponse, MovementVector
from app.services.parser import build_analysis_prompt, parse_gemma_json


class OllamaService:
    async def analyze_frame(
        self,
        image_bytes: bytes,
        mode: str,
        metrics: Dict[str, Any]
    ) -> AnalysisResponse:
        start_time = time.perf_counter()
        prompt = build_analysis_prompt(mode, metrics)
        b64_image = base64.b64encode(image_bytes).decode("utf-8")

        payload = {
            "model": settings.OLLAMA_MODEL,
            "prompt": prompt,
            "images": [b64_image],
            "stream": False,
            "options": {
                "temperature": 0.3,
                "num_predict": 256,
            },
        }

        url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/generate"

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code != 200:
                    raise RuntimeError(f"Ollama returned HTTP {res.status_code}: {res.text}")

                data = res.json()
                raw_response = data.get("response", "")
                parsed = parse_gemma_json(raw_response)

                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

                return AnalysisResponse(
                    tip=parsed["tip"],
                    movement=parsed["movement"],
                    suggested_zoom=parsed["suggested_zoom"],
                    exposure_hint=parsed["exposure_hint"],
                    shot_score=parsed["shot_score"],
                    provider="ollama",
                    model=settings.OLLAMA_MODEL,
                    latency_ms=latency_ms,
                    timestamp=time.time(),
                )

        except Exception as e:
            print(f"[OllamaService] Error connecting to Ollama: {e}")
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return AnalysisResponse(
                tip="Self-hosted Ollama offline; check runner status",
                movement=MovementVector(dx=0.0, dy=0.0),
                suggested_zoom=1.0,
                exposure_hint="ok",
                shot_score=70,
                provider="ollama (offline)",
                model=settings.OLLAMA_MODEL,
                latency_ms=latency_ms,
                timestamp=time.time(),
            )


ollama_service = OllamaService()
