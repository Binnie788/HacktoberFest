import React from 'react';
import {
  RotateCcw,
  Zap,
  ZapOff,
  Image as ImageIcon,
  Settings,
} from 'lucide-react';
import type { CameraMode } from '../types/camera';

interface CameraControlsProps {
  currentMode: CameraMode;
  onSelectMode: (mode: CameraMode) => void;
  onShutterClick: () => void;
  onFlipCamera: () => void;
  onToggleTorch: () => void;
  onOpenGallery: () => void;
  onOpenSettings: () => void;
  torchAvailable: boolean;
  torchOn: boolean;
  photoCount: number;
  isCapturing?: boolean;
}

const MODES: { id: CameraMode; label: string }[] = [
  { id: 'portrait', label: 'PORTRAIT' },
  { id: 'landscape', label: 'LANDSCAPE' },
  { id: 'street', label: 'STREET' },
  { id: 'macro', label: 'MACRO' },
  { id: 'general', label: 'AUTO' },
];

export const CameraControls: React.FC<CameraControlsProps> = ({
  currentMode,
  onSelectMode,
  onShutterClick,
  onFlipCamera,
  onToggleTorch,
  onOpenGallery,
  onOpenSettings,
  torchAvailable,
  torchOn,
  photoCount,
  isCapturing = false,
}) => {
  return (
    <div className="w-full flex flex-col items-center justify-end pb-8 pt-2 px-6 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-auto">
      {/* 1. Mode Selector Carousel */}
      <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-2 mb-6 max-w-full">
        {MODES.map((m) => {
          const isActive = m.id === currentMode;
          return (
            <button
              key={m.id}
              onClick={() => onSelectMode(m.id)}
              className={`text-xs font-semibold tracking-widest transition-all uppercase whitespace-nowrap ${
                isActive
                  ? 'text-amber-400 scale-105 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* 2. Main Shutter Row */}
      <div className="w-full max-w-md flex items-center justify-between">
        {/* Gallery Button */}
        <button
          onClick={onOpenGallery}
          className="relative w-12 h-12 rounded-2xl bg-neutral-900/80 border border-white/20 flex items-center justify-center text-white/90 hover:bg-neutral-800 transition active:scale-95"
          aria-label="Open gallery"
        >
          <ImageIcon className="w-5 h-5" />
          {photoCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-indigo-600 text-[10px] font-bold text-white border border-black shadow">
              {photoCount}
            </span>
          )}
        </button>

        {/* Tactile Shutter Button */}
        <div className="relative flex items-center justify-center">
          <button
            onClick={onShutterClick}
            disabled={isCapturing}
            className={`w-20 h-20 rounded-full border-4 border-white/80 p-1 flex items-center justify-center transition-all duration-150 active:scale-90 ${
              isCapturing ? 'opacity-60 scale-95' : 'hover:scale-105'
            }`}
            aria-label="Capture photo"
          >
            <div
              className={`w-full h-full rounded-full transition-colors ${
                isCapturing ? 'bg-amber-400' : 'bg-white shadow-[0_0_20px_rgba(255,255,255,0.4)]'
              }`}
            />
          </button>
        </div>

        {/* Camera Flip / Lens Toggle */}
        <button
          onClick={onFlipCamera}
          className="w-12 h-12 rounded-2xl bg-neutral-900/80 border border-white/20 flex items-center justify-center text-white/90 hover:bg-neutral-800 transition active:scale-95"
          aria-label="Switch camera"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* 3. Utility Secondary Bar (Torch, Settings) */}
      <div className="w-full max-w-xs flex items-center justify-center gap-6 mt-4">
        {torchAvailable && (
          <button
            onClick={onToggleTorch}
            className={`p-2 rounded-full transition ${
              torchOn ? 'text-amber-400 bg-amber-400/20' : 'text-neutral-400 hover:text-white'
            }`}
            aria-label="Toggle flashlight"
          >
            {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
          </button>
        )}

        <button
          onClick={onOpenSettings}
          className="p-2 rounded-full text-neutral-400 hover:text-white transition"
          aria-label="Settings and mode"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
