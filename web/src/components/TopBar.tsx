import React from 'react';
import { Compass, Sparkles } from 'lucide-react';
import type { CameraOverlayState } from '../types/camera';

interface TopBarProps {
  state: CameraOverlayState;
  onOpenSettings: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ state, onOpenSettings }) => {
  const { tiltAngle, isLevel, isStable, advice, isAnalyzing } = state;

  return (
    <div className="w-full flex items-center justify-between px-4 pt-4 pb-2 z-20 pointer-events-auto">
      {/* 1. Leveling Tilt Badge */}
      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-mono font-medium transition-all ${
          isLevel
            ? 'bg-sky-500/20 text-sky-300 border-sky-400/40 shadow-[0_0_12px_rgba(56,189,248,0.3)]'
            : 'bg-black/50 text-neutral-300 border-white/10'
        }`}
      >
        <Compass className={`w-3.5 h-3.5 ${isLevel ? 'text-sky-300 animate-pulse' : 'text-neutral-400'}`} />
        <span>{Math.abs(tiltAngle) <= 0.2 ? 'LEVEL' : `${tiltAngle > 0 ? '+' : ''}${tiltAngle.toFixed(1)}°`}</span>
      </div>

      {/* 2. Stability & AI Engine State */}
      <div className="flex items-center gap-2">
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-medium transition-all ${
            isStable
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              : 'bg-black/50 text-neutral-400 border-white/10'
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full ${
              isAnalyzing
                ? 'bg-indigo-400 animate-ping'
                : isStable
                ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                : 'bg-neutral-500'
            }`}
          />
          <span className="text-[11px] tracking-wider uppercase font-semibold">
            {isAnalyzing ? 'COACHING...' : isStable ? 'STEADY' : 'MOVING'}
          </span>
        </div>

        {/* 3. Composition Score Badge */}
        {advice && (
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-200 border border-purple-500/30 backdrop-blur-md text-xs font-mono font-semibold"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{advice.shotScore}</span>
          </button>
        )}
      </div>
    </div>
  );
};
