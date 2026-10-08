from typing import Optional
from pydantic import BaseModel, Field


class MetricsPayload(BaseModel):
    blur_score: float = Field(0.0, description="Variance of Laplacian or local sharpness")
    brightness: float = Field(128.0, description="Average pixel luminance 0-255")
    tilt_angle: float = Field(0.0, description="Device tilt / horizon angle in degrees")
    is_stable: bool = Field(False, description="Whether camera has been held steady for >=500ms")
    face_detected: bool = Field(False, description="Whether a face was detected on-device")
    face_x: Optional[float] = Field(None, description="Normalized face center X 0-1")
    face_y: Optional[float] = Field(None, description="Normalized face center Y 0-1")
    face_width: Optional[float] = Field(None, description="Normalized face width 0-1")
    face_height: Optional[float] = Field(None, description="Normalized face height 0-1")


class MovementVector(BaseModel):
    dx: float = Field(0.0, description="Horizontal correction: -1.0 pan left to +1.0 pan right")
    dy: float = Field(0.0, description="Vertical correction: -1.0 tilt up to +1.0 tilt down")


class AnalysisResponse(BaseModel):
    tip: str = Field(..., description="Actionable photography guidance, 12 words or fewer")
    movement: MovementVector = Field(default_factory=MovementVector)
    suggested_zoom: float = Field(1.0, ge=0.5, le=5.0, description="Recommended zoom factor")
    exposure_hint: str = Field("ok", description="'ok', 'brighten', or 'darken'")
    shot_score: int = Field(70, ge=0, le=100, description="Overall composition rating 0-100")
    provider: str = Field("gemini", description="AI backend provider utilized")
    model: str = Field("gemma-4-26b-a4b-it", description="Model identifier")
    latency_ms: float = Field(0.0, description="Inference latency in milliseconds")
    timestamp: float = Field(0.0, description="Server Unix epoch timestamp")
