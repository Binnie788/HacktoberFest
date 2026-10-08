import React from 'react';
import { Sparkles, AlertCircle, SunMedium, Moon, Activity } from 'lucide-react';
import type { CameraOverlayState } from '../types/camera';

interface GuidanceBarProps {
  state: CameraOverlayState;
  onTap?: () => void;
}

export const GuidanceBar: React.FC<GuidanceBarProps> = ({ state, onTap }) => {
  const { advice, isAnalyzing, isOffline, tipsUnavailableReason, motionWarning } = state;

  // Determine tip content and iconography
  let displayText = 'Frame your shot and hold steady for Gemma 4 coaching...';
  let badgeColor = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
  let Icon: React.ElementType = Sparkles;
  let showScore = false;

  if (motionWarning) {
    displayText = 'Subject or camera is moving too fast. Hold steady!';
    badgeColor = 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    Icon = Activity;
  } else if (isOffline || tipsUnavailableReason) {
    displayText = tipsUnavailableReason || 'Tips unavailable (offline mode)';
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    Icon = AlertCircle;
  } else if (advice) {
    displayText = advice.tip;
    badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    showScore = true;
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
      <div className="flex items-start justify-between gap-4 px-6 py-4 rounded-3xl bg-black/60 backdrop-blur-md border border-white/15 shadow-2xl">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`p-2 rounded-full border ${badgeColor} shrink-0 mt-0.5`}>
            <Icon className={`w-6 h-6 ${isAnalyzing && !motionWarning ? 'animate-spin' : ''}`} />
          </div>
          <p className="text-base sm:text-lg font-medium text-white/90 leading-snug tracking-wide break-words">
            {displayText}
          </p>
        </div>

        {showScore && advice && !motionWarning && (
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
