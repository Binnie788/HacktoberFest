import io
import time
from typing import Any, Dict
from PIL import Image
from app.config import settings
from app.models import AnalysisResponse, MovementVector
from app.services.parser import build_analysis_prompt, parse_gemma_json


class GemmaService:
    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is None and settings.GEMINI_API_KEY:
            try:
                from google import genai
                self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
            except Exception as e:
                print(f"[GemmaService] Failed to initialize Google GenAI client: {e}")
                self._client = None
        return self._client

    async def analyze_frame(
        self,
        image_bytes: bytes,
        mode: str,
        metrics: Dict[str, Any]
    ) -> AnalysisResponse:
        start_time = time.perf_counter()
        client = self._get_client()

        if not client:
            # Fallback if API key is unconfigured or unavailable
            return self._heuristic_fallback(mode, metrics, start_time, "API key not configured")

        try:
            from google.genai import types

            prompt = build_analysis_prompt(mode, metrics)
            image = Image.open(io.BytesIO(image_bytes))

            # Configure minimal thinking for fast turnaround
            try:
                config = types.GenerateContentConfig(
                    thinking_config=types.ThinkingConfig(thinking_level="minimal"),
                    temperature=0.4,
                    max_output_tokens=256,
                )
            except Exception:
                config = types.GenerateContentConfig(
                    temperature=0.4,
                    max_output_tokens=256,
                )

            # Gemma 4 multimodal inference
            response = client.models.generate_content(
                model=settings.GEMMA_MODEL_NAME,
                contents=[image, prompt],
                config=config,
            )

            raw_text = response.text or ""
            parsed = parse_gemma_json(raw_text)

            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

            return AnalysisResponse(
                tip=parsed["tip"],
                movement=parsed["movement"],
                suggested_zoom=parsed["suggested_zoom"],
                exposure_hint=parsed["exposure_hint"],
                shot_score=parsed["shot_score"],
                provider="gemini",
                model=settings.GEMMA_MODEL_NAME,
                latency_ms=latency_ms,
                timestamp=time.time(),
            )

        except Exception as e:
            print(f"[GemmaService] Inference error: {e}")
            return self._heuristic_fallback(mode, metrics, start_time, str(e))

    def _heuristic_fallback(
        self,
        mode: str,
        metrics: Dict[str, Any],
        start_time: float,
        reason: str
    ) -> AnalysisResponse:
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        tilt = metrics.get("tilt_angle", 0.0)
        brightness = metrics.get("brightness", 128.0)
        face_detected = metrics.get("face_detected", False)
        face_x = metrics.get("face_x", 0.5)

        tip = "Hold steady and frame your subject cleanly"
        dx, dy = 0.0, 0.0
        exposure = "ok"
        score = 72

        if abs(tilt) > 3.0:
            tip = "Level the horizon to balance your composition"
            score = 65
        elif brightness < 60:
            tip = "Low light detected: move towards a light source"
            exposure = "brighten"
            score = 60
        elif brightness > 220:
            tip = "Highlight blowout: lower exposure or adjust angle"
            exposure = "darken"
            score = 62
        elif face_detected and face_x is not None:
            if face_x < 0.35:
                tip = "Pan right slightly to place subject on vertical power line"
                dx = 0.3
                score = 80
            elif face_x > 0.65:
                tip = "Pan left slightly to balance subject rule of thirds"
                dx = -0.3
                score = 80
            else:
                tip = "Great subject framing! Hold steady for crisp focus"
                score = 88
        elif mode.lower() == "portrait":
            tip = "Step closer and ensure eye level aligns with top third"
            score = 78
        elif mode.lower() == "landscape":
            tip = "Align horizon with lower third to emphasize the sky"
            score = 82

        return AnalysisResponse(
            tip=tip,
            movement=MovementVector(dx=dx, dy=dy),
            suggested_zoom=1.0,
            exposure_hint=exposure,
            shot_score=score,
            provider=f"fallback ({reason[:20]})",
            model="heuristic-director",
            latency_ms=latency_ms,
            timestamp=time.time(),
        )


gemma_service = GemmaService()
