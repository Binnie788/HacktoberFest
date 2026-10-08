import React, { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    // Check if already in standalone mode
    // @ts-expect-error - iOS navigator.standalone check
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    if (isIosDevice && !isStandalone) {
      setIsIos(true);
      // Show hint once after 3 seconds if not dismissed
      const dismissed = localStorage.getItem('lumina_ios_install_dismissed');
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 3000);
      }
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const dismissed = localStorage.getItem('lumina_pwa_install_dismissed');
      if (!dismissed) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    if (isIos) {
      localStorage.setItem('lumina_ios_install_dismissed', 'true');
    } else {
      localStorage.setItem('lumina_pwa_install_dismissed', 'true');
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 max-w-sm mx-auto z-40 bg-neutral-900/95 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3 text-white animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center shrink-0 text-indigo-400">
          {isIos ? <Share className="w-5 h-5" /> : <Download className="w-5 h-5" />}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white">Install Lumina App</p>
          <p className="text-[11px] text-neutral-400 truncate">
            {isIos
              ? 'Tap Share then "Add to Home Screen"'
              : 'Add to home screen for fullscreen view'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!isIos && (
          <button
            onClick={handleInstallClick}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition"
          >
            Install
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
