import type { CameraMode, CoachingAdvice, LocalMetrics } from '../types/camera';

export type SlowLoopCallback = (advice: CoachingAdvice | null, errorReason?: string) => void;

export class SlowLoopEngine {
  private isAnalyzing: boolean = false;
  private lastRequestTime: number = 0;
  private minIntervalMs: number = import.meta.env.VITE_GEMMA_POLL_INTERVAL_MS 
    ? parseInt(import.meta.env.VITE_GEMMA_POLL_INTERVAL_MS, 10) 
    : 1500; // Default to 1.5s for live feedback (configurable via .env)
  private requireStability: boolean = import.meta.env.VITE_REQUIRE_STABILITY === 'true';

  private lastSentMetrics: LocalMetrics | null = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private callback: SlowLoopCallback | null = null;

  // Stale detection
  private activeRequestTilt: number = 0;

  constructor(callback: SlowLoopCallback) {
    this.callback = callback;
  }

  public setInterval(ms: number) {
    this.minIntervalMs = ms;
  }

  public shouldTrigger(metrics: LocalMetrics): boolean {
    const now = Date.now();

    // 1. Check stability (if configured to require it)
    if (this.requireStability && !metrics.isStable) return false;

    // 2. Previous request must have finished
    if (this.isAnalyzing) return false;

    // 3. Minimum cooldown interval
    if (now - this.lastRequestTime < this.minIntervalMs) return false;

    // 4. Scene change check
    if (this.lastSentMetrics) {
      const tiltDiff = Math.abs(metrics.tiltAngle - this.lastSentMetrics.tiltAngle);
      const brightnessDiff = Math.abs(metrics.brightness - this.lastSentMetrics.brightness);
      
      const thresholdTilt = import.meta.env.VITE_SCENE_CHANGE_TILT ? parseFloat(import.meta.env.VITE_SCENE_CHANGE_TILT) : 0.8;
      const thresholdBrightness = import.meta.env.VITE_SCENE_CHANGE_BRIGHTNESS ? parseInt(import.meta.env.VITE_SCENE_CHANGE_BRIGHTNESS, 10) : 15;

      const changed = tiltDiff > thresholdTilt || brightnessDiff > thresholdBrightness;
      if (!changed) return false;
    }

    return true;
  }

  public async evaluateFrame(
    video: HTMLVideoElement,
    mode: CameraMode,
    metrics: LocalMetrics
  ): Promise<void> {
    if (!this.shouldTrigger(metrics)) return;

    this.isAnalyzing = true;
    this.lastRequestTime = Date.now();
    this.lastSentMetrics = { ...metrics };
    this.activeRequestTilt = metrics.tiltAngle;

    try {
      // 1. Downscale frame to ~640px width JPEG for minimal bandwidth and latency
      const blob = await this.captureDownscaledJpeg(video, 640);
      if (!blob) {
        this.isAnalyzing = false;
        return;
      }

      // 2. Prepare payload
      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');
      formData.append('mode', mode);
      formData.append(
        'metrics',
        JSON.stringify({
          tilt_angle: metrics.tiltAngle,
          brightness: metrics.brightness,
          blur_score: metrics.blurScore,
          is_stable: metrics.isStable,
          face_detected: metrics.faceDetected,
          face_x: metrics.faceBox ? metrics.faceBox.x + metrics.faceBox.width / 2 : null,
          face_y: metrics.faceBox ? metrics.faceBox.y + metrics.faceBox.height / 2 : null,
        })
      );

      // 3. Dispatch to API
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 429) {
          if (this.callback) this.callback(null, 'Rate limited (coaching paused)');
        } else {
          if (this.callback) this.callback(null, `Server response (${response.status})`);
        }
        this.isAnalyzing = false;
        return;
      }

      const data = await response.json();

      // 4. Stale-response check: Did user move significantly during the ~1.5s flight?
      const currentTiltDiff = Math.abs(metrics.tiltAngle - this.activeRequestTilt);
      if (currentTiltDiff > 3.5 || !metrics.isStable) {
        console.log('[SlowLoop] User moved during analysis; discarding stale vector.');
        // Still display tip but clear stale movement vector
        data.movement = { dx: 0, dy: 0 };
      }

      const advice: CoachingAdvice = {
        tip: data.tip,
        movement: data.movement || { dx: 0, dy: 0 },
        suggestedZoom: data.suggested_zoom ?? 1.0,
        exposureHint: data.exposure_hint ?? 'ok',
        shotScore: data.shot_score ?? 75,
        provider: data.provider ?? 'gemini',
        model: data.model ?? 'gemma-4-26b-a4b-it',
        latencyMs: data.latency_ms ?? 0,
        timestamp: Date.now(),
      };

      if (this.callback) {
        this.callback(advice);
      }
    } catch (err) {
      console.warn('[SlowLoop] Analysis fetch error:', err);
      if (this.callback) {
        this.callback(null, 'Tips unavailable (offline)');
      }
    } finally {
      this.isAnalyzing = false;
    }
  }

  private async captureDownscaledJpeg(
    video: HTMLVideoElement,
    targetWidth: number
  ): Promise<Blob | null> {
    if (!video.videoWidth || !video.videoHeight) return null;

    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement('canvas');
    }

    const scale = targetWidth / video.videoWidth;
    const targetHeight = Math.round(video.videoHeight * scale);

    this.offscreenCanvas.width = targetWidth;
    this.offscreenCanvas.height = targetHeight;

    const ctx = this.offscreenCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

    return new Promise<Blob | null>((resolve) => {
      this.offscreenCanvas!.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        0.75
      );
    });
  }

  public getAnalyzingStatus(): boolean {
    return this.isAnalyzing;
  }
}
