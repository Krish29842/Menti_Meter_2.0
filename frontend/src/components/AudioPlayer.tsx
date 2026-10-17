import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Play, Pause, AlertCircle } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  autoPlay?: boolean;
  title?: string;
  className?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  autoPlay = false,
  title = 'Audio Clue',
  className = '',
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setAutoplayBlocked(false);
    setHasError(false);

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      if (autoPlay) {
        audioRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
            setAutoplayBlocked(false);
          })
          .catch(() => {
            // Browser blocked autoplay
            setAutoplayBlocked(true);
          });
      }
    }
  }, [src, autoPlay]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setAutoplayBlocked(false);
        })
        .catch(() => {
          setHasError(true);
        });
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!src) return null;

  return (
    <div
      className={`rounded-2xl border border-indigo-500/30 bg-slate-900/90 p-4 shadow-xl backdrop-blur-md ${className}`}
    >
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        onError={() => setHasError(true)}
      />

      {autoplayBlocked && !isPlaying && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-amber-500/20 px-3 py-2 text-xs font-medium text-amber-300 border border-amber-500/30">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>Audio ready — tap to listen to clue!</span>
          </div>
          <button
            onClick={togglePlay}
            className="rounded-lg bg-amber-500 px-2.5 py-1 text-slate-950 font-bold text-xs hover:bg-amber-400 active:scale-95 transition-all"
          >
            Play Now
          </button>
        </div>
      )}

      {hasError ? (
        <div className="flex items-center gap-2 text-xs text-rose-400">
          <AlertCircle className="h-4 w-4" />
          <span>Could not load audio source. Check link or format.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
              <span className="text-xs font-semibold tracking-wide text-indigo-300 uppercase">
                {title}
              </span>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all active:scale-95 shadow-lg ${
                isPlaying
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 ring-2 ring-amber-400/50'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500'
              }`}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 ml-0.5 fill-current" />}
            </button>

            {/* Audio Waveform visualization */}
            <div className="flex-1 flex flex-col gap-1">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-indigo-500"
              />
              <div className="flex items-center justify-center gap-0.5 h-4">
                {[40, 70, 20, 90, 60, 30, 85, 45, 100, 65, 35, 80, 50, 95, 30, 70, 40].map((h, i) => (
                  <span
                    key={i}
                    style={{ height: isPlaying ? `${Math.max(15, (h * Math.sin((currentTime * 5) + i)) % 100)}%` : '20%' }}
                    className={`w-1 rounded-full transition-all duration-150 ${
                      isPlaying ? 'bg-indigo-400' : 'bg-slate-600'
                    }`}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={toggleMute}
              className="p-2 text-slate-400 hover:text-white transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
