import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { OverlayCanvas } from './OverlayCanvas';
import type { CameraOverlayState } from '../types/camera';

interface ViewfinderProps {
  state: CameraOverlayState;
  onVideoReady: (video: HTMLVideoElement) => void;
  onCameraError?: (error: string) => void;
  onCapabilitiesChange?: (torchAvailable: boolean) => void;
  torchOn: boolean;
}

export const Viewfinder = React.forwardRef<
  { captureStill: () => Promise<Blob | null> },
  ViewfinderProps
>(({ state, onVideoReady, onCameraError, onCapabilitiesChange, torchOn }, ref) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const imageCaptureRef = useRef<any>(null);

  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // Stop camera tracks cleanly
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    imageCaptureRef.current = null;
  }, []);

  // Initialize camera
  const startCamera = useCallback(async () => {
    stopStream();
    setIsInitializing(true);
    setErrorMessage(null);

    const facingModeConstraint = state.facingMode === 'environment'
      ? { ideal: 'environment' }
      : { exact: 'user' };

    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: facingModeConstraint,
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
      },
      audio: false,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setPermissionState('granted');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        onVideoReady(videoRef.current);
      }

      // Check track capabilities (e.g., torch, zoom)
      const track = stream.getVideoTracks()[0];
      if (track) {
        if (typeof (window as any).ImageCapture === 'function') {
          imageCaptureRef.current = new (window as any).ImageCapture(track);
        }

        const capabilities = track.getCapabilities ? (track.getCapabilities() as Record<string, any>) : {};
        const torchAvailable = Boolean(capabilities.torch);
        if (onCapabilitiesChange) {
          onCapabilitiesChange(torchAvailable);
        }
      }
    } catch (err: any) {
      console.warn('[Viewfinder] Camera initialization failed:', err);
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      setPermissionState(isDenied ? 'denied' : 'prompt');
      setErrorMessage(
        isDenied
          ? 'Camera access was denied. Please allow camera permissions in your browser settings to use Lumina.'
          : `Unable to access camera: ${err.message || 'Unknown device error'}`
      );
      if (onCameraError) {
        onCameraError(err.message);
      }
    } finally {
      setIsInitializing(false);
    }
  }, [state.facingMode, stopStream, onVideoReady, onCameraError, onCapabilitiesChange]);

  // Handle Torch Toggle
  useEffect(() => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        track.applyConstraints({
          advanced: [{ torch: torchOn } as any],
        }).catch(() => {
          // Torch not supported or rejected
        });
      }
    }
  }, [torchOn]);

  // Handle visibility changes (stop tracks when app is backgrounded to preserve battery/privacy)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        stopStream();
      } else {
        startCamera();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [startCamera, stopStream]);

  // Restart camera when facing mode changes
  useEffect(() => {
    startCamera();
    return () => {
      stopStream();
    };
  }, [state.facingMode]);

  // Expose full-resolution capture method via ref
  React.useImperativeHandle(ref, () => ({
    captureStill: async (): Promise<Blob | null> => {
      // 1. Try native ImageCapture.takePhoto() for max resolution still
      if (imageCaptureRef.current && typeof imageCaptureRef.current.takePhoto === 'function') {
        try {
          const blob = await imageCaptureRef.current.takePhoto({
            imageWidth: 3840,
            imageHeight: 2160,
          });
          if (blob) return blob;
        } catch (e) {
          console.warn('[Viewfinder] ImageCapture takePhoto failed, falling back to canvas:', e);
        }
      }

      // 2. High-resolution canvas snapshot fallback
      if (videoRef.current && videoRef.current.videoWidth) {
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // If front-facing, mirror horizontally
          if (state.facingMode === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          return new Promise<Blob | null>((resolve) => {
            canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95);
          });
        }
      }

      return null;
    },
  }));

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
      {/* Live Video Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          state.facingMode === 'user' ? '-scale-x-100' : ''
        } ${permissionState === 'granted' ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Layered Transparent Canvas Overlays */}
      {permissionState === 'granted' && (
        <OverlayCanvas state={state} />
      )}

      {/* Permission Denied UI */}
      {permissionState === 'denied' && (
        <div className="absolute inset-0 bg-neutral-950/90 flex flex-col items-center justify-center p-6 text-center z-30">
          <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4 border border-rose-500/30">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Camera Access Required</h2>
          <p className="text-neutral-400 text-sm max-w-xs mb-6">
            {errorMessage || 'Lumina requires camera permission for live viewfinder framing and coaching.'}
          </p>
          <button
            onClick={startCamera}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      )}

      {/* Initializing Loading State */}
      {isInitializing && permissionState !== 'denied' && (
        <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-20">
          <div className="w-12 h-12 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin mb-4" />
          <p className="text-white/70 text-sm tracking-wide">Starting optical sensors...</p>
        </div>
      )}
    </div>
  );
});

Viewfinder.displayName = 'Viewfinder';
