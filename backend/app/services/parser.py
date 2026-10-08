import json
import re
from typing import Any, Dict
from app.models import MovementVector


def build_analysis_prompt(mode: str, metrics: Dict[str, Any]) -> str:
    """
    Constructs a concise, highly constrained prompt for Gemma 4.
    """
    metrics_summary = []
    if metrics.get("tilt_angle") is not None:
        metrics_summary.append(f"Tilt angle: {metrics['tilt_angle']:.1f}°")
    if metrics.get("brightness") is not None:
        metrics_summary.append(f"Scene brightness: {metrics['brightness']:.0f}/255")
    if metrics.get("blur_score") is not None:
        metrics_summary.append(f"Sharpness index: {metrics['blur_score']:.1f}")
    if metrics.get("face_detected"):
        metrics_summary.append(
            f"Subject face detected at center ({metrics.get('face_x', 0.5):.2f}, {metrics.get('face_y', 0.5):.2f})"
        )

    context_str = ", ".join(metrics_summary) if metrics_summary else "Normal conditions"

    return f"""You are an elite Director of Photography acting as a live camera coach.
Target shooting mode: {mode.upper()}
On-device sensor telemetry: {context_str}

Analyze the framing, subject placement, lighting, rule-of-thirds, and camera level (tilt angle) in this photo.
If the camera tilt is high, explicitly tell the user to level the camera. If the subject is dead center, explicitly suggest using rule-of-thirds or a more dynamic framing method. Focus heavily on spatial adjustments: suggest stepping closer, stepping farther back, or moving left/right.
CRITICAL CONSTRAINT: You MUST respond with ONLY a single, valid JSON object and NOTHING ELSE. No introductory text, no conversational remarks, no markdown fence.

JSON SCHEMA:
{{
  "tip": "Actionable instruction, strictly 25 words or fewer (e.g. 'Level the camera and move the subject to the right third for better balance. Step closer.')",
  "movement": {{
    "dx": <float from -1.0 to 1.0; negative means pan left, positive means pan right, 0.0 means good>,
    "dy": <float from -1.0 to 1.0; negative means tilt up, positive means tilt down, 0.0 means good>
  }},
  "suggested_zoom": <float between 0.5 and 3.0; 1.0 means current framing is good>,
  "exposure_hint": "<strictly one of: 'ok', 'brighten', or 'darken'>",
  "shot_score": <integer from 0 to 100 assessing aesthetic quality and framing>
}}"""


def clean_json_text(raw_text: str) -> str:
    """
    Removes markdown code blocks, thoughts, and extraneous text wrapping.
    """
    text = raw_text.strip()

    # Strip thinking blocks if model emitted <thought> or <reasoning>
    text = re.sub(r"<thought>.*?</thought>", "", text, flags=re.DOTALL)
    text = re.sub(r"<reasoning>.*?</reasoning>", "", text, flags=re.DOTALL)

    # Strip ```json ... ``` or ``` ... ```
    if "```" in text:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if match:
            text = match.group(1).strip()

    # Extract outermost JSON object {...}
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]

    return text.strip()


def parse_gemma_json(raw_text: str) -> Dict[str, Any]:
    """
    Tolerantly parses model output into structured coaching data.
    Guarantees valid structure and never raises unhandled exceptions.
    """
    cleaned = clean_json_text(raw_text)

    try:
        data = json.loads(cleaned)
    except Exception:
        # Fallback regex extraction if JSON is slightly malformed
        tip_match = re.search(r'"tip"\s*:\s*"([^"]+)"', raw_text)
        tip = tip_match.group(1) if tip_match else "Hold steady and frame your subject cleanly"
        return {
            "tip": tip[:90],
            "movement": MovementVector(dx=0.0, dy=0.0),
            "suggested_zoom": 1.0,
            "exposure_hint": "ok",
            "shot_score": 70,
        }

    # Normalize fields
    raw_tip = str(data.get("tip", "Hold steady and balance the frame")).strip()
    # Enforce 28-word limit strictly if model exceeded it
    words = raw_tip.split()
    if len(words) > 30:
        raw_tip = " ".join(words[:28]) + "..."

    movement_data = data.get("movement", {})
    try:
        dx = float(movement_data.get("dx", 0.0))
        dy = float(movement_data.get("dy", 0.0))
        dx = max(-1.0, min(1.0, dx))
        dy = max(-1.0, min(1.0, dy))
    except (ValueError, TypeError):
        dx, dy = 0.0, 0.0

    try:
        zoom = float(data.get("suggested_zoom", 1.0))
        zoom = max(0.5, min(3.0, zoom))
    except (ValueError, TypeError):
        zoom = 1.0

    exposure = str(data.get("exposure_hint", "ok")).lower().strip()
    if exposure not in ("ok", "brighten", "darken"):
        exposure = "ok"

    try:
        score = int(data.get("shot_score", 75))
        score = max(0, min(100, score))
    except (ValueError, TypeError):
        score = 75

    return {
        "tip": raw_tip,
        "movement": MovementVector(dx=dx, dy=dy),
        "suggested_zoom": zoom,
        "exposure_hint": exposure,
        "shot_score": score,
    }
