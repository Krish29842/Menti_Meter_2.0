import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { SplitScreenDemo } from './components/SplitScreenDemo';
import { LandingView } from './views/LandingView';
import { HostDashboardView } from './views/HostDashboardView';
import { QuizBuilderView } from './views/QuizBuilderView';
import { HostLiveView } from './views/HostLiveView';
import { StudentJoinView } from './views/StudentJoinView';
import { StudentLiveView } from './views/StudentLiveView';
import type { Participant } from './types/quiz';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<string>('landing');
  const [viewParams, setViewParams] = useState<any>({});
  const [splitDemoOpen, setSplitDemoOpen] = useState<boolean>(false);

  // Active student participant state if playing
  const [activeParticipant, setActiveParticipant] = useState<Participant | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string>('');

  // Handle URL hash changes (e.g. #join=583921)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#join=')) {
        const pin = hash.replace('#join=', '');
        handleNavigate('student-join', { pin });
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleNavigate = (view: string, params: any = {}) => {
    setCurrentView(view);
    setViewParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStudentJoined = (participant: Participant, sessionId: string) => {
    setActiveParticipant(participant);
    setActiveSessionId(sessionId);
    setCurrentView('student-live');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Navigation Top Bar */}
      <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenSplitDemo={() => setSplitDemoOpen(true)}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {currentView === 'landing' && (
          <LandingView
            onNavigate={handleNavigate}
            onOpenSplitDemo={() => setSplitDemoOpen(true)}
          />
        )}

        {currentView === 'host-dashboard' && (
          <HostDashboardView onNavigate={handleNavigate} />
        )}

        {currentView === 'quiz-builder' && (
          <QuizBuilderView
            quizId={viewParams.quizId}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'host-live' && (
          <HostLiveView
            sessionId={viewParams.sessionId}
            quizId={viewParams.quizId}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'student-join' && (
          <StudentJoinView
            initialPin={viewParams.pin || ''}
            onJoined={handleStudentJoined}
          />
        )}

        {currentView === 'student-live' && activeParticipant && (
          <StudentLiveView
            participant={activeParticipant}
            sessionId={activeSessionId}
            onExit={() => handleNavigate('landing')}
          />
        )}
      </main>

      {/* Interactive Split-Screen Live Demo Modal */}
      <SplitScreenDemo
        isOpen={splitDemoOpen}
        onClose={() => setSplitDemoOpen(false)}
      />

      {/* Minimal Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">QuizWave 2.0</span>
            <span>• Mentimeter-style live quiz platform</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Speed-weighted scoring</span>
            <span>•</span>
            <span>Host Privacy (FR-H3S)</span>
            <span>•</span>
            <span>Image & Audio Clues</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
