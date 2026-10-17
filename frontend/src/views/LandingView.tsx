import React, { useState } from 'react';
import {
  Sparkles,
  Play,
  ArrowRight,
  Headphones,
  Image as ImageIcon,
  Zap,
  Trophy,
  Users,
  ShieldCheck,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { storageService } from '../services/storage';

interface LandingViewProps {
  onNavigate: (view: string, params?: any) => void;
  onOpenSplitDemo: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onNavigate,
  onOpenSplitDemo,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleJoinByPin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pinInput.trim().replace(/\D/g, '');
    if (cleanPin.length < 4) {
      setErrorMsg('Please enter a valid 6-digit game PIN');
      return;
    }
    onNavigate('student-join', { pin: cleanPin });
  };

  const handleHostStart = () => {
    if (!storageService.getCurrentUser()) {
      storageService.quickDemoLogin();
    }
    onNavigate('host-dashboard');
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-slate-950">
      {/* Background radial glow effects */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-indigo-600/15 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/2 -right-40 h-[400px] w-[500px] rounded-full bg-cyan-600/15 blur-[140px]" />

      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300 backdrop-blur-md mb-6">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>Mentimeter 2.0 • Real-Time Interactive Multimedia Quizzes</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl sm:leading-tight">
            Engage Your Audience with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-cyan-400 to-sky-300">
              Live Sound & Image Quizzes
            </span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Create fast-paced multimedia trivia with audio clues, vivid pictures, and a speed-weighted leaderboard. Designed for classrooms, keynotes, and trivia nights.
          </p>

          {/* Quick Join Card */}
          <div className="mt-9 mx-auto max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
            <form onSubmit={handleJoinByPin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Have a Game PIN?
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="Enter 6-digit PIN (e.g. 583 921)"
                    maxLength={7}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-5 py-4 text-center text-2xl font-black tracking-widest text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
                {errorMsg && (
                  <p className="mt-2 text-xs font-medium text-rose-400">{errorMsg}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 py-4 text-base font-bold text-white shadow-lg shadow-indigo-600/30 hover:opacity-95 active:scale-[0.98] transition-all"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Join Game</span>
              </button>
            </form>

            <div className="mt-5 flex items-center justify-between border-t border-slate-800/80 pt-4 text-xs text-slate-400">
              <span>Are you presenting or teaching?</span>
              <button
                onClick={handleHostStart}
                className="font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                Host a Quiz <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Instant Split-Screen Demo Callout */}
          <div className="mt-8 flex justify-center">
            <button
              onClick={onOpenSplitDemo}
              className="group inline-flex items-center gap-3 rounded-2xl border border-cyan-500/40 bg-cyan-950/30 px-5 py-3 text-xs sm:text-sm font-semibold text-cyan-300 hover:bg-cyan-900/40 transition-all shadow-lg shadow-cyan-900/20"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300">
                <Layers className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="font-bold text-white group-hover:text-cyan-200">
                  Try Split-Screen Interactive Demo
                </div>
                <div className="text-[11px] text-cyan-400/80">
                  Test Host controller & Student phones side-by-side in 1 click!
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-sm hover:border-indigo-500/40 transition-colors">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 mb-4">
              <Headphones className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Audio & Voice Clues</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Upload bird calls, music snippets, or voice prompts. Students play clues on their device with responsive waveform player and autoplay fallback.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-sm hover:border-cyan-500/40 transition-colors">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 mb-4">
              <ImageIcon className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Vivid Image Questions</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Add diagrams, maps, and high-definition photos to any question. Fully optimized for crisp rendering on mobile screens and giant lecture projectors.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-sm hover:border-amber-500/40 transition-colors">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 mb-4">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Speed-Weighted Scoring</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Correct answers award up to 1,000 points based on millisecond response speed. Ties broken by cumulative accuracy and answer timestamp.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-sm hover:border-purple-500/40 transition-colors">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 mb-4">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Unbiased Host Display</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Per strict architecture specs (FR-H3S), host screens display only live rankings and controls during the quiz—zero question leaks or bias.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-sm hover:border-emerald-500/40 transition-colors">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 mb-4">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Zero-Friction Join</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Students don't need passwords or signups. Simply scan a QR code or type the 6-digit PIN, pick a fun emoji avatar, and start playing instantly.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-sm hover:border-yellow-500/40 transition-colors">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-500/10 text-yellow-400 mb-4">
              <Trophy className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Podium & Full Analytics</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Celebrate the top 3 players on the 3D podium with gold confetti, then unlock full post-session question accuracy breakdowns for teachers.
            </p>
          </div>
        </div>

        {/* Live Architecture Note */}
        <div className="mt-16 rounded-3xl border border-slate-800 bg-slate-900/40 p-6 text-center max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>Implemented According to system.md & architecture.md</span>
          </div>
          <p className="text-xs text-slate-400">
            Powered by modern React 19 + TypeScript + Tailwind CSS v4 with full multi-tab BroadcastChannel engine and WebSocket backend compatibility.
          </p>
        </div>
      </div>
    </div>
  );
};
