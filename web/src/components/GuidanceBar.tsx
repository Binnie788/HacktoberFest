import React from 'react';
import { Sparkles, AlertCircle, SunMedium, Moon } from 'lucide-react';
import type { CameraOverlayState } from '../types/camera';

interface GuidanceBarProps {
  state: CameraOverlayState;
  onTap?: () => void;
}

export const GuidanceBar: React.FC<GuidanceBarProps> = ({ state, onTap }) => {
  const { advice, isAnalyzing, isOffline, tipsUnavailableReason } = state;

  // Determine tip content and iconography
  let displayText = 'Frame your shot and hold steady for Gemma 4 coaching...';
  let badgeColor = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
  let Icon = Sparkles;

  if (isOffline || tipsUnavailableReason) {
    displayText = tipsUnavailableReason || 'Tips unavailable (offline mode)';
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    Icon = AlertCircle;
  } else if (advice) {
    displayText = advice.tip;
    badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (advice.exposureHint === 'brighten') {
      Icon = Moon;
    } else if (advice.exposureHint === 'darken') {
      Icon = SunMedium;
    } else {
      Icon = Sparkles;
    }
  }

  return (
    <div
      className="w-full max-w-lg px-4 py-3 mx-auto select-none transition-all duration-300"
    >
      <div className="flex items-center justify-between gap-4 px-6 py-4 rounded-full bg-black/60 backdrop-blur-md border border-white/15 shadow-2xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-full border ${badgeColor} shrink-0`}>
            <Icon className={`w-6 h-6 ${isAnalyzing ? 'animate-spin' : ''}`} />
          </div>
          <p className="text-base sm:text-lg font-medium text-white/90 truncate tracking-wide">
            {displayText}
          </p>
        </div>

        {advice && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-mono px-3 py-1 rounded-full bg-white/10 text-emerald-400 font-semibold border border-emerald-500/30">
              {advice.shotScore}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
