import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Smartphone,
  Cpu,
  Compass,
  CheckCircle2,
} from 'lucide-react';
import { motionService } from '../services/motion';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstallPwa?: () => void;
  canInstallPwa?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onInstallPwa,
  canInstallPwa,
}) => {
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [motionPermitted, setMotionPermitted] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/info')
        .then((res) => res.json())
        .then((data) => setServerInfo(data))
        .catch(() => setServerInfo(null));

      setMotionPermitted(motionService.getSnapshot().permissionGranted);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestMotion = async () => {
    const granted = await motionService.requestPermission();
    setMotionPermitted(granted);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col text-white animate-in fade-in duration-200">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <h2 className="text-base font-semibold tracking-wide">Lumina Settings & Info</h2>
        <button
          onClick={onClose}
          className="p-2 -mr-2 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition"
          aria-label="Close settings"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-xl mx-auto w-full space-y-6">
        {/* 1. AI Director Engine Status */}
        <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10 space-y-3">
          <div className="flex items-center gap-2.5 text-indigo-400">
            <Cpu className="w-5 h-5" />
            <h3 className="font-semibold text-sm text-white">AI Coaching Model</h3>
          </div>

          <div className="text-xs space-y-2 text-neutral-300">
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-neutral-400">Architecture</span>
              <span className="font-mono font-medium text-emerald-400">Gemma 4 (Open-Weight)</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-neutral-400">Active Mode</span>
              <span className="font-mono text-white">
                {serverInfo?.is_hosted ? 'Cloud Hosted (Google GenAI)' : 'Self-Hosted (Ollama)'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-neutral-400">Model ID</span>
              <span className="font-mono text-neutral-200">
                {serverInfo?.gemma_model || 'gemma-4-26b-a4b-it'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-neutral-400">Inference Cadence</span>
              <span className="font-mono text-neutral-200">Rate-limited 2.5s-3.0s (15 RPM max)</span>
            </div>
          </div>
        </div>

        {/* 2. Privacy Guarantee */}
        <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10 space-y-2.5">
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="font-semibold text-sm text-white">Privacy by Default</h3>
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed">
            Lumina Camera never logs or stores camera frames on servers.
            In hosted mode, downscaled frames are processed in-memory solely for
            instant photographic feedback. In self-hosted mode with Ollama, no data leaves your local network.
          </p>
        </div>

        {/* 3. Sensor & Gyro Controls (iOS motion permission) */}
        <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10 space-y-3">
          <div className="flex items-center gap-2 text-sky-400">
            <Compass className="w-5 h-5" />
            <h3 className="font-semibold text-sm text-white">Horizon & Motion Sensors</h3>
          </div>
          <p className="text-xs text-neutral-300">
            Enables sub-millisecond horizon level feedback and motion stability tracking.
          </p>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-neutral-400">Status</span>
            {motionPermitted ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Calibrated & Active
              </span>
            ) : (
              <button
                onClick={handleRequestMotion}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition"
              >
                Enable Motion Sensor
              </button>
            )}
          </div>
        </div>

        {/* 4. PWA Installation */}
        <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10 space-y-3">
          <div className="flex items-center gap-2 text-amber-400">
            <Smartphone className="w-5 h-5" />
            <h3 className="font-semibold text-sm text-white">Install PWA on Device</h3>
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed">
            Lumina can run as a standalone fullscreen app without browser chrome.
          </p>

          {canInstallPwa && onInstallPwa ? (
            <button
              onClick={onInstallPwa}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs tracking-wide transition shadow"
            >
              Install Lumina Camera App
            </button>
          ) : (
            <div className="text-xs text-neutral-400 space-y-1 bg-black/40 p-3 rounded-lg border border-white/5">
              <p className="font-medium text-white/80">How to install:</p>
              <p>• <strong>iOS Safari:</strong> Tap Share icon → select <em>"Add to Home Screen"</em></p>
              <p>• <strong>Android Chrome:</strong> Tap three dots ⋮ → select <em>"Add to Home screen"</em> or <em>"Install app"</em></p>
            </div>
          )}
        </div>

        {/* 5. Open-Source Credits & License */}
        <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10 space-y-2">
          <h3 className="font-semibold text-xs text-neutral-400 uppercase tracking-wider">
            Open-Source Compliance
          </h3>
          <p className="text-xs text-neutral-400">
            Licensed under <strong>Apache-2.0</strong>. Built with Google Gemma 4 (Apache-2.0 open-weight), FastAPI, React, and Vite PWA.
          </p>
        </div>
      </div>
    </div>
  );
};
