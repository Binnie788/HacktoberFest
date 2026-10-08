import type { BoundingBox, LocalMetrics } from '../types/camera';
import { motionService } from './motion.ts';

// Rule of Thirds power points (normalized 0-1)
const POWER_POINTS = [
  { x: 1 / 3, y: 1 / 3 },
  { x: 2 / 3, y: 1 / 3 },
  { x: 1 / 3, y: 2 / 3 },
  { x: 2 / 3, y: 2 / 3 },
];

export type FastLoopCallback = (metrics: LocalMetrics, isPowerPoint: boolean) => void;

export class FastLoopEngine {
  private worker: Worker | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private isRunning: boolean = false;
  private animFrameId: number | null = null;
  private isProcessingWorkerFrame: boolean = false;

  // Stability detection state
  private stableSince: number = 0;
  private isCurrentlyStable: boolean = false;
  private previousTilt: number = 0;
  private latestMetrics: LocalMetrics = {
    blurScore: 0,
    brightness: 128,
    tiltAngle: 0,
    rollAngle: 0,
    isStable: false,
    frameDelta: 0,
    faceDetected: false,
  };

  private callback: FastLoopCallback | null = null;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    try {
      this.worker = new Worker(
        new URL('../workers/visionWorker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (e) => {
        this.isProcessingWorkerFrame = false;
        if (e.data.type === 'METRICS_RESULT') {
          this.handleWorkerMetrics(e.data);
        }
      };

      this.worker.onerror = (err) => {
        console.warn('[FastLoop] Vision worker error, falling back:', err);
        this.isProcessingWorkerFrame = false;
      };
    } catch (e) {
      console.warn('[FastLoop] Could not instantiate Web Worker:', e);
    }
  }

  public start(video: HTMLVideoElement, onUpdate: FastLoopCallback) {
    this.videoEl = video;
    this.callback = onUpdate;
    this.isRunning = true;
    this.loop();
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private loop = () => {
    if (!this.isRunning) return;

    if (this.videoEl && this.videoEl.readyState >= 2 && !this.videoEl.paused) {
      this.tick();
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private async tick() {
    if (!this.videoEl) return;

    // Dispatch frame to worker if worker is idle
    if (this.worker && !this.isProcessingWorkerFrame) {
      try {
        if (typeof createImageBitmap === 'function') {
          this.isProcessingWorkerFrame = true;
          const bitmap = await createImageBitmap(this.videoEl);
          this.worker.postMessage(
            { type: 'PROCESS_FRAME', imageBitmap: bitmap },
            [bitmap]
          );
        }
      } catch {
        this.isProcessingWorkerFrame = false;
      }
    }
  }

  private handleWorkerMetrics(data: {
    blurScore: number;
    brightness: number;
    frameDelta: number;
    faceBox: BoundingBox | null;
  }) {
    const orientation = motionService.getSnapshot();
    const now = Date.now();

    // Tilt delta
    const tiltDelta = Math.abs(orientation.tiltAngle - this.previousTilt);
    this.previousTilt = orientation.tiltAngle;

    // Movement threshold check
    // If frame MSE is high OR orientation changed rapidly, reset steadiness timer
    const isMoving = data.frameDelta > 6.0 || tiltDelta > 2.0;

    if (isMoving) {
      this.stableSince = 0;
      this.isCurrentlyStable = false;
    } else {
      if (this.stableSince === 0) {
        this.stableSince = now;
      } else if (now - this.stableSince >= 300) {
        // Held steady for at least 300ms
        if (!this.isCurrentlyStable) {
          this.isCurrentlyStable = true;
          // Gentle haptic feedback on steady lock
          motionService.triggerHaptic(15);
        }
      }
    }

    // Check Rule-of-Thirds power point alignment
    let isPowerPoint = false;
    let enrichedFaceBox: BoundingBox | undefined = undefined;

    if (data.faceBox) {
      const centerX = data.faceBox.x + data.faceBox.width / 2;
      const centerY = data.faceBox.y + data.faceBox.height / 2;

      for (const pt of POWER_POINTS) {
        const dist = Math.hypot(centerX - pt.x, centerY - pt.y);
        if (dist <= 0.08) {
          isPowerPoint = true;
          break;
        }
      }

      enrichedFaceBox = {
        ...data.faceBox,
        isPowerPoint,
      };
    }

    const motionWarning = data.frameDelta > 12.0 || tiltDelta > 4.5;

    this.latestMetrics = {
      blurScore: data.blurScore,
      brightness: data.brightness,
      tiltAngle: orientation.tiltAngle,
      rollAngle: orientation.pitchAngle,
      isStable: this.isCurrentlyStable,
      frameDelta: data.frameDelta,
      faceDetected: Boolean(data.faceBox),
      faceBox: enrichedFaceBox,
      motionWarning,
    };

    if (this.callback) {
      this.callback(this.latestMetrics, isPowerPoint);
    }
  }

  public getLatestMetrics(): LocalMetrics {
    return this.latestMetrics;
  }

  public destroy() {
    this.stop();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
