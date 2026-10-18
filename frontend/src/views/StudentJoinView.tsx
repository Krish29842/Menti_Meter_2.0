import React, { useState } from 'react';
import { Play, Sparkles, User, KeyRound, AlertCircle } from 'lucide-react';
import { realtimeEngine } from '../services/realtimeEngine';
import type { Participant } from '../types/quiz';

interface StudentJoinViewProps {
  initialPin?: string;
  onJoined: (participant: Participant, sessionId: string) => void;
}

const AVATARS = [
  '🚀', '🦁', '🦊', '⚡', '🐼', '🎯', '🐯', '🦄',
  '🦉', '🐙', '🐉', '🌈', '🎸', '🏄‍♂️', '🏆', '💎',
];

export const StudentJoinView: React.FC<StudentJoinViewProps> = ({
  initialPin = '',
  onJoined,
}) => {
  const [pin, setPin] = useState<string>(initialPin);
  const [displayName, setDisplayName] = useState<string>('');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(AVATARS[0]);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.trim().replace(/\D/g, '');
    if (!cleanPin || cleanPin.length < 4) {
      setErrorMsg('Please enter a valid 6-digit Game PIN.');
      return;
    }
    if (!displayName.trim()) {
      setErrorMsg('Please enter your nickname.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      // Locate + join active session via the realtime engine
      // (backend REST/socket.io when reachable, local bus otherwise).
      const { participant, session } = await realtimeEngine.joinByCode(
        cleanPin,
        displayName.trim(),
        selectedAvatar
      );
      setLoading(false);
      onJoined(participant, session.id);
    } catch {
      setErrorMsg('No active session found with this PIN. Check code and try again.');
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-8 bg-slate-950">
      {/* Glow backgrounds */}
      <div className="pointer-events-none absolute h-96 w-96 rounded-full bg-indigo-600/10 blur-[100px]" />

      <div className="relative w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-semibold text-cyan-300 mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Student Join Screen</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Join the Live Quiz
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Enter your game PIN, choose your nickname & avatar to jump in!
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-rose-500/20 p-3 text-xs font-semibold text-rose-300 border border-rose-500/30">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Game PIN input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Game PIN
            </label>
            <div className="relative">
              <KeyRound className="absolute left-4 top-3.5 h-5 w-5 text-slate-500" />
              <input
                type="text"
                placeholder="6-digit PIN (e.g. 583 921)"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setErrorMsg('');
                }}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-3.5 pl-12 pr-4 text-base font-black tracking-widest text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Nickname input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Nickname / Display Name
            </label>
            <div className="relative">
              <User className="absolute left-4 top-3.5 h-5 w-5 text-slate-500" />
              <input
                type="text"
                maxLength={20}
                placeholder="e.g. SpeedRacer, Maya"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setErrorMsg('');
                }}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-3.5 pl-12 pr-4 text-base font-bold text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Avatar Picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Choose Avatar
            </label>
            <div className="grid grid-cols-8 gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
              {AVATARS.map((av) => (
                <button
                  type="button"
                  key={av}
                  onClick={() => setSelectedAvatar(av)}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg transition-all active:scale-90 ${
                    selectedAvatar === av
                      ? 'bg-indigo-600 ring-2 ring-indigo-400 shadow-md scale-110'
                      : 'hover:bg-slate-800'
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 py-4 text-base font-extrabold text-white shadow-xl shadow-indigo-600/30 hover:opacity-95 active:scale-95 transition-all mt-4"
          >
            <Play className="h-5 w-5 fill-current" />
            <span>Enter Quiz Lobby</span>
          </button>
        </form>
      </div>
    </div>
  );
};
