export type CameraMode = 'portrait' | 'landscape' | 'street' | 'macro' | 'general';

export interface BoundingBox {
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  width: number;
  height: number;
  isPowerPoint?: boolean;
}

export interface DirectionVector {
  dx: number; // -1 (pan left) to +1 (pan right)
  dy: number; // -1 (tilt up) to +1 (tilt down)
}

export interface LocalMetrics {
  blurScore: number;
  brightness: number;
  tiltAngle: number;
  rollAngle: number;
  isStable: boolean;
  frameDelta: number;
  faceDetected: boolean;
  faceBox?: BoundingBox;
}

export interface CoachingAdvice {
  tip: string;
  movement: DirectionVector;
  suggestedZoom: number;
  exposureHint: 'ok' | 'brighten' | 'darken';
  shotScore: number;
  provider: string;
  model: string;
  latencyMs: number;
  timestamp: number;
}

export interface CameraOverlayState {
  // Motion & Orientation
  tiltAngle: number; // Degrees (-90 to +90)
  rollAngle: number; // Degrees
  isLevel: boolean;  // True within ±1°

  // Visual Quality
  brightness: number; // 0 - 255
  blurScore: number;  // Sharpness metric
  isStable: boolean;  // Steady for >= 500ms

  // Subjects & Composition
  subjectBox: BoundingBox | null;
  gridPowerPointAligned: boolean;

  // Gemma Coaching
  advice: CoachingAdvice | null;
  directionArrow: DirectionVector | null;
  isAnalyzing: boolean;
  isOffline: boolean;
  tipsUnavailableReason?: string;

  // Active Settings
  mode: CameraMode;
  facingMode: 'environment' | 'user';
  torchAvailable: boolean;
  torchOn: boolean;
}

export interface CapturedPhoto {
  id: string;
  blob: Blob;
  dataUrl: string;
  timestamp: number;
  mode: CameraMode;
  tipShown: string;
  shotScore: number;
  provider: string;
  metrics: {
    tiltAngle: number;
    brightness: number;
    blurScore: number;
  };
}
