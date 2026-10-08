export interface OrientationData {
  tiltAngle: number; // Horizon roll angle in degrees
  pitchAngle: number;
  isLevel: boolean;
  supported: boolean;
  permissionGranted: boolean;
}

type OrientationListener = (data: OrientationData) => void;

class MotionService {
  private listeners: Set<OrientationListener> = new Set();
  private currentTilt: number = 0;
  private currentPitch: number = 0;
  private hasPermission: boolean = false;
  private isSupported: boolean = false;
  private hasVibratedLevel: boolean = false;

  constructor() {
    this.checkSupport();
  }

  private checkSupport() {
    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      this.isSupported = true;
      // On non-iOS, permissions are auto-granted
      // @ts-expect-error - iOS specific property
      if (typeof DeviceOrientationEvent.requestPermission !== 'function') {
        this.hasPermission = true;
        this.startListening();
      }
    }
  }

  public async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // @ts-expect-error - iOS specific permission request
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
      try {
        // @ts-expect-error - iOS specific permission request
        const response = await DeviceOrientationEvent.requestPermission();
        if (response === 'granted') {
          this.hasPermission = true;
          this.startListening();
          return true;
        }
      } catch (e) {
        console.warn('[MotionService] Orientation permission request rejected:', e);
      }
      return false;
    }

    this.hasPermission = true;
    this.startListening();
    return true;
  }

  private startListening() {
    window.addEventListener('deviceorientation', this.handleOrientation, true);
  }

  private handleOrientation = (event: DeviceOrientationEvent) => {
    // gamma is left-to-right tilt in degrees [-90, 90]
    // beta is front-to-back tilt in degrees [-180, 180]
    const gamma = event.gamma ?? 0;
    const beta = event.beta ?? 0;

    // In portrait orientation: gamma represents roll/horizon tilt
    const tilt = Math.max(-45, Math.min(45, gamma));
    this.currentTilt = tilt;
    this.currentPitch = beta;

    const isLevel = Math.abs(tilt) <= 1.0;

    // Haptic feedback when freshly leveling
    if (isLevel && !this.hasVibratedLevel) {
      this.triggerHaptic(25);
      this.hasVibratedLevel = true;
    } else if (!isLevel) {
      this.hasVibratedLevel = false;
    }

    const payload: OrientationData = {
      tiltAngle: tilt,
      pitchAngle: beta,
      isLevel,
      supported: this.isSupported,
      permissionGranted: this.hasPermission,
    };

    this.listeners.forEach((fn) => fn(payload));
  };

  public subscribe(listener: OrientationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): OrientationData {
    return {
      tiltAngle: this.currentTilt,
      pitchAngle: this.currentPitch,
      isLevel: Math.abs(this.currentTilt) <= 1.0,
      supported: this.isSupported,
      permissionGranted: this.hasPermission,
    };
  }

  public triggerHaptic(durationMs: number = 30) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(durationMs);
      } catch {
        // Safe ignore
      }
    }
  }

  public destroy() {
    window.removeEventListener('deviceorientation', this.handleOrientation, true);
    this.listeners.clear();
  }
}

export const motionService = new MotionService();
