import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Radio,
  Sparkles,
  LayoutDashboard,
  Smartphone,
  LogOut,
  User,
  Layers,
} from 'lucide-react';
import { audioService } from '../services/audioEffects';
import { storageService } from '../services/storage';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenSplitDemo: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onOpenSplitDemo,
}) => {
  const [soundOn, setSoundOn] = useState(audioService.isEnabled());
  const currentUser = storageService.getCurrentUser();

  const handleToggleSound = () => {
    const next = audioService.toggleSound();
    setSoundOn(next);
  };

  const handleLogout = () => {
    storageService.logout();
    onNavigate('landing');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div
          onClick={() => onNavigate('landing')}
          className="flex cursor-pointer items-center gap-3 group"
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-2 shadow-lg shadow-indigo-500/25 transition-transform group-hover:scale-105">
            <Radio className="h-5 w-5 text-white" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black tracking-tight text-white">
                Quiz<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Wave</span>
              </span>
              <span className="rounded-full bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-bold text-indigo-400 border border-indigo-500/20">
                2.0
              </span>
            </div>
            <p className="hidden sm:block text-[10px] text-slate-400 font-medium">
              Live Multimedia Interactive Quizzes
            </p>
          </div>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-2xl border border-slate-800">
          <button
            onClick={() => onNavigate('landing')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              currentView === 'landing'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Home
          </button>
          <button
            onClick={() => onNavigate('host-dashboard')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              currentView.startsWith('host')
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Host Studio
          </button>
          <button
            onClick={() => onNavigate('student-join')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              currentView.startsWith('student')
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            Join as Student
          </button>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Split Screen Demo Toggle */}
          <button
            onClick={onOpenSplitDemo}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 px-3 py-1.5 text-xs font-bold text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 active:scale-95 transition-all shadow-sm"
            title="Open side-by-side Host & Student interactive live testing mode"
          >
            <Layers className="h-3.5 w-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Split Screen Demo</span>
            <span className="sm:hidden">Split</span>
          </button>

          {/* Sound FX Toggle */}
          <button
            onClick={handleToggleSound}
            className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition-all"
            title={soundOn ? 'Sound Effects Enabled (Click to Mute)' : 'Sound Effects Muted (Click to Unmute)'}
          >
            {soundOn ? (
              <Volume2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <VolumeX className="h-4 w-4 text-slate-500" />
            )}
          </button>

          {/* User profile / Demo login */}
          {currentUser ? (
            <div className="flex items-center gap-2">
              <div className="hidden lg:flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-1.5 border border-slate-800">
                <div className="h-5 w-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold">
                  {currentUser.name.charAt(0)}
                </div>
                <span className="text-xs font-semibold text-slate-200">
                  {currentUser.name}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-all"
                title="Log out Host"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                storageService.quickDemoLogin();
                onNavigate('host-dashboard');
              }}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 active:scale-95 transition-all shadow-md shadow-indigo-600/30"
            >
              <User className="h-3.5 w-3.5" />
              <span>Host Login</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
