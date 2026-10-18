import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, AlertCircle } from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  className?: string;
  isThumbnail?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  autoPlay = true,
  loop = true,
  muted = false,
  controls = true,
  className = '',
  isThumbnail = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsPlaying(autoPlay);
    setIsMuted(muted);
    setHasError(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      if (autoPlay) {
        videoRef.current.play().catch(() => {
          // Autoplay with sound might be blocked, try muted
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.play().catch(() => setIsPlaying(false));
          }
        });
      }
    }
  }, [src, autoPlay, muted]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  if (!src) return null;

  if (hasError) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 p-4 text-xs text-rose-400 ${className}`}>
        <AlertCircle className="h-4 w-4 mr-2 shrink-0" />
        <span>Unable to play video</span>
      </div>
    );
  }

  return (
    <div className={`relative group overflow-hidden rounded-2xl bg-black flex items-center justify-center ${className}`}>
      <video
        ref={videoRef}
        src={src}
        autoPlay={autoPlay}
        loop={loop}
        muted={isMuted}
        playsInline
        onError={() => setHasError(true)}
        className="w-full h-full object-contain max-h-72 rounded-2xl"
      />

      {/* Overlay controls for main question video */}
      {!isThumbnail && controls && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-xl bg-black/70 backdrop-blur-md p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={togglePlay}
            className="p-1 rounded-lg text-white hover:bg-white/20 transition-colors"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className="p-1 rounded-lg text-white hover:bg-white/20 transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
          </button>
        </div>
      )}

      {/* Thumbnail indicator badge for options */}
      {isThumbnail && (
        <div className="absolute top-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider backdrop-blur-xs">
          Video
        </div>
      )}
    </div>
  );
};
