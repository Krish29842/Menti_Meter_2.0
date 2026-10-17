import React, { useEffect, useState } from 'react';
import { X, Layers, Smartphone, Monitor, RotateCcw } from 'lucide-react';
import { HostLiveView } from '../views/HostLiveView';
import { StudentLiveView } from '../views/StudentLiveView';
import { realtimeEngine } from '../services/realtimeEngine';
import { storageService } from '../services/storage';
import type { Participant, Quiz, Session } from '../types/quiz';

interface SplitScreenDemoProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SplitScreenDemo: React.FC<SplitScreenDemoProps> = ({
  isOpen,
  onClose,
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [student1, setStudent1] = useState<Participant | null>(null);

  const initDemo = () => {
    const quizzes = storageService.getQuizzes();
    const targetQuiz = quizzes[0] || null;
    if (!targetQuiz) return;
    setQuiz(targetQuiz);

    // Create session
    const s = realtimeEngine.createSession(targetQuiz.id, 'host-demo');
    setSession(s);

    // Auto-join Student 1
    const p1 = realtimeEngine.joinSession(s.id, 'Alex 🚀', '🚀');
    setStudent1(p1);

    // Add extra bot participants for realistic classroom crowd
    setTimeout(() => {
      realtimeEngine.addDemoBotStudents(s.id, 3);
    }, 200);
  };

  useEffect(() => {
    if (isOpen) {
      initDemo();
    }
  }, [isOpen]);

  if (!isOpen || !session || !quiz || !student1) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md animate-fade-in">
      {/* Top Banner */}
      <div className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <span>Interactive Split-Screen Simulation</span>
              <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] text-cyan-300 border border-cyan-500/30">
                Host + Student Live Synced
              </span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={initDemo}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
            title="Restart demo session"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset Session</span>
          </button>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* LEFT COLUMN: Host Presentation Screen (Col 7) */}
        <div className="lg:col-span-7 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-950 overflow-y-auto p-4 sm:p-6">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3">
            <Monitor className="h-4 w-4" />
            <span>Host Screen (Leaderboard Only • FR-H3S Compliant)</span>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-2 sm:p-4">
            <HostLiveView
              sessionId={session.id}
              quizId={quiz.id}
              onNavigate={() => onClose()}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Student Device Phone Frame (Col 5) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-start bg-slate-900/40 p-4 sm:p-6 overflow-y-auto">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3">
            <Smartphone className="h-4 w-4" />
            <span>Student Mobile Device (Alex 🚀)</span>
          </div>

          {/* Simulated Mobile Mockup Frame */}
          <div className="w-full max-w-sm rounded-[40px] border-4 border-slate-700 bg-slate-950 shadow-2xl p-3 min-h-[600px] flex flex-col">
            {/* Phone Speaker Notch */}
            <div className="mx-auto h-4 w-24 rounded-full bg-slate-800 mb-2" />

            <div className="flex-1 overflow-y-auto rounded-[32px] bg-slate-950">
              <StudentLiveView
                participant={student1}
                sessionId={session.id}
                onExit={onClose}
              />
            </div>

            {/* Phone Home Bar */}
            <div className="mx-auto mt-2 h-1 w-28 rounded-full bg-slate-700" />
          </div>
        </div>
      </div>
    </div>
  );
};
