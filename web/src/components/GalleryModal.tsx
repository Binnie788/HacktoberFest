import React, { useState } from 'react';
import {
  X,
  Share2,
  Trash2,
  Calendar,
  Sparkles,
  Compass,
  ArrowLeft,
  Download,
} from 'lucide-react';
import type { CapturedPhoto } from '../types/camera';

interface GalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  photos: CapturedPhoto[];
  onDeletePhoto: (id: string) => Promise<void>;
}

export const GalleryModal: React.FC<GalleryModalProps> = ({
  isOpen,
  onClose,
  photos,
  onDeletePhoto,
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<CapturedPhoto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleShare = async (photo: CapturedPhoto) => {
    try {
      const file = new File([photo.blob], `lumina_${photo.id}.jpg`, {
        type: 'image/jpeg',
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Photo coached by Lumina Gemma 4',
          text: `Coached by Lumina AI: "${photo.tipShown}" (Composition Score: ${photo.shotScore}/100)`,
        });
      } else {
        // Fallback: Trigger browser file download
        const a = document.createElement('a');
        a.href = photo.dataUrl;
        a.download = `lumina_${photo.id}.jpg`;
        a.click();
      }
    } catch (err) {
      console.warn('[Gallery] Sharing failed or cancelled:', err);
    }
  };

  const handleDelete = async (photo: CapturedPhoto) => {
    if (confirm('Delete this photo permanently from device storage?')) {
      setIsDeleting(true);
      await onDeletePhoto(photo.id);
      setIsDeleting(false);
      setSelectedPhoto(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col text-white animate-in fade-in duration-200">
      {/* Top App Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          {selectedPhoto ? (
            <button
              onClick={() => setSelectedPhoto(null)}
              className="p-2 -ml-2 rounded-full hover:bg-white/10 transition"
              aria-label="Back to grid"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : null}
          <h2 className="text-base font-semibold tracking-wide">
            {selectedPhoto ? 'Photo Inspection' : `Local Gallery (${photos.length})`}
          </h2>
        </div>

        <button
          onClick={onClose}
          className="p-2 -mr-2 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition"
          aria-label="Close gallery"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content: Detail View vs Grid View */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {selectedPhoto ? (
          /* Detail View */
          <div className="max-w-2xl mx-auto flex flex-col gap-6">
            <div className="relative rounded-2xl overflow-hidden bg-neutral-900 border border-white/10 shadow-2xl flex items-center justify-center">
              <img
                src={selectedPhoto.dataUrl}
                alt="Captured still"
                className="w-full max-h-[60vh] object-contain"
              />

              <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                SCORE: {selectedPhoto.shotScore}
              </div>
            </div>

            {/* Coaching & EXIF Telemetry Card */}
            <div className="p-4 rounded-xl bg-neutral-900/80 border border-white/10 space-y-3">
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">
                    Gemma 4 Live Coaching Tip
                  </p>
                  <p className="text-sm font-medium text-white/90 mt-0.5">
                    "{selectedPhoto.tipShown || 'Freeform capture'}"
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10 text-xs text-neutral-300">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-sky-400" />
                  <span>Tilt at capture: {selectedPhoto.metrics.tiltAngle.toFixed(1)}°</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  <span>
                    {new Date(selectedPhoto.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleShare(selectedPhoto)}
                className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium text-sm flex items-center justify-center gap-2 transition"
              >
                <Share2 className="w-4 h-4" />
                Share / Save
              </button>

              <button
                onClick={() => handleDelete(selectedPhoto)}
                disabled={isDeleting}
                className="py-3 px-4 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 font-medium text-sm flex items-center justify-center gap-2 transition"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        ) : photos.length === 0 ? (
          /* Empty State */
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-neutral-500">
              <Download className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">No Photos Yet</h3>
            <p className="text-sm text-neutral-400 max-w-xs">
              Frame your subject, hold steady for Gemma coaching, and hit the shutter!
            </p>
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-5xl mx-auto">
            {photos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => setSelectedPhoto(photo)}
                className="group relative aspect-square rounded-xl overflow-hidden bg-neutral-900 border border-white/10 cursor-pointer hover:border-white/40 transition-all"
              >
                <img
                  src={photo.dataUrl}
                  alt="Thumbnail"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end">
                  <p className="text-[11px] font-medium text-white truncate">
                    {photo.tipShown}
                  </p>
                </div>
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-mono text-emerald-400 font-bold border border-white/10">
                  {photo.shotScore}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
