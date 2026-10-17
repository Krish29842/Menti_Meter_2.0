import React, { useEffect, useState } from 'react';
import { audioService } from '../services/audioEffects';

interface TimerGaugeProps {
  deadline: number; // Unix timestamp in ms
  timeLimitSec: number;
  onExpire?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const TimerGauge: React.FC<TimerGaugeProps> = ({
  deadline,
  timeLimitSec,
  onExpire,
  size = 'md',
}) => {
  const [remainingSec, setRemainingSec] = useState<number>(timeLimitSec);

  useEffect(() => {
    let lastPlayedSec = -1;

    const interval = setInterval(() => {
      const now = Date.now();
      const diffMs = deadline - now;
      const sec = Math.max(0, Math.ceil(diffMs / 1000));
      setRemainingSec(sec);

      // Play audio cues
      if (sec !== lastPlayedSec && sec > 0) {
        lastPlayedSec = sec;
        if (sec <= 5) {
          audioService.playWarning();
        } else if (sec <= 10) {
          audioService.playTick();
        }
      }

      if (diffMs <= 0) {
        clearInterval(interval);
        if (onExpire) onExpire();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [deadline, onExpire]);

  const fraction = Math.min(1, Math.max(0, remainingSec / timeLimitSec));
  const strokeColor =
    fraction > 0.5
      ? '#10b981' // emerald
      : fraction > 0.25
      ? '#f59e0b' // amber
      : '#f43f5e'; // rose

  const dim = size === 'sm' ? 48 : size === 'md' ? 72 : 110;
  const strokeWidth = size === 'sm' ? 5 : size === 'md' ? 7 : 9;
  const radius = (dim - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - fraction);

  return (
    <div className="relative flex items-center justify-center">
      <svg
        width={dim}
        height={dim}
        className={`transform -rotate-90 ${fraction < 0.25 && remainingSec > 0 ? 'animate-pulse' : ''}`}
      >
        {/* Background track */}
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          stroke="#1e293b"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Active progress */}
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          style={{ transition: 'stroke-dashoffset 0.15s linear, stroke 0.3s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center font-black">
        <span
          style={{ color: strokeColor }}
          className={`font-mono leading-none tracking-tight ${
            size === 'sm' ? 'text-sm font-bold' : size === 'md' ? 'text-2xl' : 'text-4xl'
          }`}
        >
          {remainingSec}
        </span>
        {size !== 'sm' && (
          <span className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">sec</span>
        )}
      </div>
    </div>
  );
};
