import { useState, useEffect, useRef, useCallback } from 'react';
import type { CameraMode, CameraOverlayState, CapturedPhoto, LocalMetrics } from './types/camera';
import { Viewfinder } from './components/Viewfinder';
import { TopBar } from './components/TopBar';
import { GuidanceBar } from './components/GuidanceBar';
import { CameraControls } from './components/CameraControls';
import { GalleryModal } from './components/GalleryModal';
import { SettingsModal } from './components/SettingsModal';
import { InstallPrompt } from './components/InstallPrompt';
import { FastLoopEngine } from './services/fastLoop';
import { SlowLoopEngine } from './services/slowLoop';
import { motionService } from './services/motion';
import { getAllPhotos, savePhoto, deletePhoto, requestPersistentStorage } from './services/storage';

export function App() {
  // Master reactive overlay state
  const [overlayState, setOverlayState] = useState<CameraOverlayState>({
    tiltAngle: 0,
    rollAngle: 0,
    isLevel: false,
    brightness: 128,
    blurScore: 0,
    isStable: false,
    subjectBox: null,
    gridPowerPointAligned: false,
    advice: null,
    directionArrow: null,
    isAnalyzing: false,
    isOffline: false,
    mode: 'general',
    facingMode: 'environment',
    torchAvailable: false,
    torchOn: false,
  });

  // Photo captures state
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [flashActive, setFlashActive] = useState(false);

  // References
  const viewfinderRef = useRef<{ captureStill: () => Promise<Blob | null> } | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const fastLoopRef = useRef<FastLoopEngine | null>(null);
  const slowLoopRef = useRef<SlowLoopEngine | null>(null);

  // 1. Initialize DB & persistent storage on mount
  useEffect(() => {
    requestPersistentStorage();
    getAllPhotos().then(setPhotos).catch(console.warn);
  }, []);

  // 2. Setup Slow Loop instance
  useEffect(() => {
    slowLoopRef.current = new SlowLoopEngine((advice, errorReason) => {
      setOverlayState((prev) => ({
        ...prev,
        advice: advice || prev.advice,
        directionArrow: advice ? advice.movement : null,
        isAnalyzing: false,
        tipsUnavailableReason: errorReason,
      }));
    });
  }, []);

  // 3. Fast Loop callback (feeds 30 FPS updates to overlay state)
  const handleFastLoopUpdate = useCallback((metrics: LocalMetrics, isPowerPoint: boolean) => {
    setOverlayState((prev) => ({
      ...prev,
      tiltAngle: metrics.tiltAngle,
      rollAngle: metrics.rollAngle,
      isLevel: Math.abs(metrics.tiltAngle) <= 1.0,
      brightness: metrics.brightness,
      blurScore: metrics.blurScore,
      isStable: metrics.isStable,
      subjectBox: metrics.faceBox || null,
      gridPowerPointAligned: isPowerPoint,
    }));

    // Feed to Slow Loop for Gemma 4 coaching evaluation
    if (videoElementRef.current && slowLoopRef.current) {
      if (slowLoopRef.current.shouldTrigger(metrics)) {
        setOverlayState((prev) => ({ ...prev, isAnalyzing: true }));
        slowLoopRef.current.evaluateFrame(
          videoElementRef.current,
          overlayState.mode,
          metrics
        );
      }
    }
  }, [overlayState.mode]);

  // 4. Video ready handler
  const handleVideoReady = useCallback((video: HTMLVideoElement) => {
    videoElementRef.current = video;

    if (!fastLoopRef.current) {
      fastLoopRef.current = new FastLoopEngine();
    }
    fastLoopRef.current.start(video, handleFastLoopUpdate);
  }, [handleFastLoopUpdate]);

  // Clean up loops on unmount
  useEffect(() => {
    return () => {
      if (fastLoopRef.current) {
        fastLoopRef.current.destroy();
      }
    };
  }, []);

  // 5. Shutter capture handler (Step 8)
  const handleCapture = async () => {
    if (!viewfinderRef.current || isCapturing) return;

    setIsCapturing(true);
    setFlashActive(true);
    motionService.triggerHaptic(45);

    setTimeout(() => setFlashActive(false), 150);

    try {
      const blob = await viewfinderRef.current.captureStill();
      if (blob) {
        const id = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newPhoto = await savePhoto({
          id,
          blob,
          timestamp: Date.now(),
          mode: overlayState.mode,
          tipShown: overlayState.advice?.tip || 'Auto framing',
          shotScore: overlayState.advice?.shotScore || 75,
          provider: overlayState.advice?.provider || 'local',
          metrics: {
            tiltAngle: overlayState.tiltAngle,
            brightness: overlayState.brightness,
            blurScore: overlayState.blurScore,
          },
        });

        setPhotos((prev) => [newPhoto, ...prev]);
        motionService.triggerHaptic(20);
      }
    } catch (e) {
      console.warn('[App] Capture failed:', e);
    } finally {
      setIsCapturing(false);
    }
  };

  // 6. Camera Flip
  const handleFlipCamera = () => {
    motionService.triggerHaptic(20);
    setOverlayState((prev) => ({
      ...prev,
      facingMode: prev.facingMode === 'environment' ? 'user' : 'environment',
      torchOn: false,
    }));
  };

  // 7. Toggle Torch
  const handleToggleTorch = () => {
    setOverlayState((prev) => ({
      ...prev,
      torchOn: !prev.torchOn,
    }));
  };

  // 8. Mode select
  const handleSelectMode = (mode: CameraMode) => {
    motionService.triggerHaptic(15);
    setOverlayState((prev) => ({ ...prev, mode }));
  };

  // 9. Photo deletion
  const handleDeletePhoto = async (id: string) => {
    await deletePhoto(id);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col select-none touch-none">
      {/* Visual Flash Effect */}
      {flashActive && (
        <div className="absolute inset-0 bg-white z-50 pointer-events-none transition-opacity duration-150 animate-out fade-out" />
      )}

      {/* Live Viewfinder & Canvas Layer */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        <Viewfinder
          ref={viewfinderRef}
          state={overlayState}
          onVideoReady={handleVideoReady}
          onCapabilitiesChange={(torchAvailable) =>
            setOverlayState((prev) => ({ ...prev, torchAvailable }))
          }
          torchOn={overlayState.torchOn}
        />

        {/* HUD Elements Stacked Over Viewfinder */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-10">
          {/* Top Bar Status */}
          <TopBar
            state={overlayState}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />

          {/* Center Floating Guidance Bar */}
          <div className="pointer-events-auto">
            <GuidanceBar
              state={overlayState}
            />
          </div>

          {/* Bottom Controls */}
          <CameraControls
            currentMode={overlayState.mode}
            onSelectMode={handleSelectMode}
            onShutterClick={handleCapture}
            onFlipCamera={handleFlipCamera}
            onToggleTorch={handleToggleTorch}
            onOpenGallery={() => setIsGalleryOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            torchAvailable={overlayState.torchAvailable}
            torchOn={overlayState.torchOn}
            photoCount={photos.length}
            isCapturing={isCapturing}
          />
        </div>
      </div>

      {/* PWA Install Banner */}
      <InstallPrompt />

      {/* Local Photo Gallery Modal */}
      <GalleryModal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        photos={photos}
        onDeletePhoto={handleDeletePhoto}
      />

      {/* Settings & Info Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

export default App;
