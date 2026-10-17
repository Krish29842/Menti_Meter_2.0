import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Users,
  Play,
  QrCode,
  Copy,
  Check,
  ChevronRight,
  StopCircle,
  Trophy,
  Award,
  Medal,
  Clock,
  Sparkles,
  BarChart3,
  Bot,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import type { HostLiveStateDTO, LeaderboardEntry, Quiz, Session } from '../types/quiz';
import { realtimeEngine } from '../services/realtimeEngine';
import { storageService } from '../services/storage';
import { audioService } from '../services/audioEffects';
import { TimerGauge } from '../components/TimerGauge';
import { QRCodeModal } from '../components/QRCodeModal';

interface HostLiveViewProps {
  sessionId: string;
  quizId: string;
  onNavigate: (view: string, params?: any) => void;
}

export const HostLiveView: React.FC<HostLiveViewProps> = ({
  sessionId,
  quizId,
  onNavigate,
}) => {
  const [session] = useState<Session | null>(() =>
    realtimeEngine.getSessionById(sessionId)
  );
  const [quiz] = useState<Quiz | null>(() => storageService.getQuizById(quizId) || null);

  const [liveState, setLiveState] = useState<HostLiveStateDTO>({
    sessionId,
    code: session?.code || '',
    status: session?.status || 'lobby',
    currentQuestionIndex: session?.currentQuestionIndex ?? -1,
    totalQuestions: session?.totalQuestions || quiz?.questions.length || 0,
    connectedStudentsCount: 0,
    answeredStudentsCount: 0,
    timeRemainingSec: 20,
    timeLimitSec: 20,
    leaderboard: [],
  });

  const [showQRModal, setShowQRModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [deadline, setDeadline] = useState<number>(Date.now() + 20000);

  // Subscribe to real-time events
  useEffect(() => {
    const unsub = realtimeEngine.subscribe((msg) => {
      if (msg.sessionId !== sessionId) return;

      if (msg.type === 'STUDENT_JOINED') {
        setLiveState((prev) => {
          const exists = prev.leaderboard.some(
            (e) => e.participantId === msg.payload.participant.id
          );
          if (exists) return prev;
          const newEntry: LeaderboardEntry = {
            participantId: msg.payload.participant.id,
            displayName: msg.payload.participant.displayName,
            avatar: msg.payload.participant.avatar,
            score: 0,
            rank: prev.leaderboard.length + 1,
            delta: 0,
          };
          return {
            ...prev,
            connectedStudentsCount: prev.connectedStudentsCount + 1,
            leaderboard: [...prev.leaderboard, newEntry],
          };
        });
      } else if (msg.type === 'QUESTION_OPEN') {
        const hostDTO = msg.payload.hostDTO as HostLiveStateDTO;
        setLiveState((prev) => ({
          ...prev,
          ...hostDTO,
          status: 'question_open',
          currentQuestionIndex: msg.payload.questionIndex,
          timeLimitSec: msg.payload.timeLimitSec,
          answeredStudentsCount: 0,
        }));
        setDeadline(msg.payload.deadline);
      } else if (msg.type === 'LEADERBOARD_UPDATED') {
        if (msg.payload.leaderboard) {
          setLiveState((prev) => ({
            ...prev,
            leaderboard: msg.payload.leaderboard,
            connectedStudentsCount:
              msg.payload.totalParticipants ?? prev.connectedStudentsCount,
            answeredStudentsCount:
              msg.payload.answeredCount ?? prev.answeredStudentsCount,
          }));
        }
      } else if (msg.type === 'QUESTION_CLOSED') {
        const hostDTO = msg.payload.hostDTO as HostLiveStateDTO;
        setLiveState((prev) => ({
          ...prev,
          status: 'question_closed',
          leaderboard: msg.payload.leaderboard || prev.leaderboard,
          roundSummary: msg.payload.roundSummary || hostDTO?.roundSummary,
        }));
      } else if (msg.type === 'SESSION_ENDED') {
        setLiveState((prev) => ({
          ...prev,
          status: 'ended',
          leaderboard: msg.payload.finalLeaderboard || prev.leaderboard,
        }));
        audioService.playFanfare();
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
        });
      }
    });

    return () => unsub();
  }, [sessionId]);

  const handleStartQuiz = () => {
    realtimeEngine.startSession(sessionId);
  };

  const handleNextQuestion = () => {
    realtimeEngine.nextQuestion();
  };

  const handleCloseQuestionEarly = () => {
    realtimeEngine.closeQuestion();
  };

  const handleEndQuiz = () => {
    if (confirm('Are you sure you want to end this live session?')) {
      realtimeEngine.endSession(sessionId);
    }
  };

  const handleAddDemoBots = () => {
    realtimeEngine.addDemoBotStudents(sessionId, 4);
  };

  const handleCopyJoinLink = () => {
    const cleanPin = (session?.code || '').replace(/\D/g, '');
    const url = `${window.location.origin}/#join=${cleanPin}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // 1. LOBBY SCREEN
  if (liveState.status === 'lobby') {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 text-center animate-fade-in">
        <QRCodeModal
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          sessionCode={session?.code || ''}
        />

        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
          <span>Live Session Lobby • {quiz?.title || 'QuizWave Live'}</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
          Join at <span className="text-indigo-400">quizwave.live</span> or scan QR
        </h1>

        {/* Big Game PIN Card */}
        <div className="my-8 mx-auto max-w-lg rounded-3xl border border-indigo-500/40 bg-gradient-to-b from-slate-900 to-slate-950 p-8 shadow-2xl backdrop-blur-xl">
          <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
            Game PIN
          </div>
          <div className="text-5xl sm:text-6xl font-black font-mono tracking-widest text-white drop-shadow-md">
            {session?.code || '000-000'}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setShowQRModal(true)}
              className="flex items-center gap-2 rounded-2xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 active:scale-95 transition-all border border-slate-700"
            >
              <QrCode className="h-4 w-4 text-cyan-400" />
              <span>Show QR Code</span>
            </button>

            <button
              onClick={handleCopyJoinLink}
              className="flex items-center gap-2 rounded-2xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 active:scale-95 transition-all border border-slate-700"
            >
              {copiedLink ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span>Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-indigo-400" />
                  <span>Copy Join Link</span>
                </>
              )}
            </button>

            <button
              onClick={handleAddDemoBots}
              className="flex items-center gap-2 rounded-2xl bg-indigo-950/60 px-4 py-2.5 text-xs font-bold text-indigo-300 hover:bg-indigo-900/60 active:scale-95 transition-all border border-indigo-700/50"
              title="Add 4 simulated test students to test live quiz flow immediately"
            >
              <Bot className="h-4 w-4 text-cyan-400" />
              <span>+ Add Demo Students</span>
            </button>
          </div>
        </div>

        {/* Connected Participants Count & Avatars */}
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-6">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
              <Users className="h-4 w-4 text-indigo-400" />
              <span>
                {liveState.connectedStudentsCount}{' '}
                {liveState.connectedStudentsCount === 1 ? 'Student' : 'Students'} Joined
              </span>
            </div>
            <span className="text-xs text-slate-500">
              Waiting for host to start...
            </span>
          </div>

          {liveState.leaderboard.length === 0 ? (
            <div className="py-12 rounded-3xl border border-dashed border-slate-800 text-slate-500 text-sm">
              No students connected yet. Share the PIN or click "+ Add Demo Students" above!
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {liveState.leaderboard.map((student) => (
                <div
                  key={student.participantId}
                  className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-3 shadow-md animate-scale-in"
                >
                  <span className="text-2xl">{student.avatar}</span>
                  <span className="truncate text-xs font-bold text-slate-200">
                    {student.displayName}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Start Quiz CTA */}
          <div className="mt-10 flex justify-center">
            <button
              onClick={handleStartQuiz}
              disabled={liveState.connectedStudentsCount === 0}
              className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 px-8 py-4 text-base font-extrabold text-white shadow-xl shadow-indigo-600/30 hover:opacity-95 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Play className="h-5 w-5 fill-current" />
              <span>Start Quiz ({quiz?.questions.length} Questions)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. LIVE QUESTION / ROUND ACTIVE OR ROUND CLOSED (FR-H2S & FR-H3S COMPLIANT)
  // Host sees ONLY the leaderboard and control panels!
  if (
    liveState.status === 'question_open' ||
    liveState.status === 'question_closed'
  ) {
    const isRoundOpen = liveState.status === 'question_open';
    const isLastQuestion =
      liveState.currentQuestionIndex >= liveState.totalQuestions - 1;

    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Compliance Notice Badge */}
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-indigo-950/40 border border-indigo-500/20 px-4 py-2 text-xs text-indigo-300">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-cyan-400" />
            <span>
              <strong>Host Privacy Mode Active (FR-H3S):</strong> Host screen displays live ranking & connection statistics only.
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-400">PIN: {session?.code}</span>
        </div>

        {/* Top Control Bar */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-xl mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Question progress indicator */}
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 font-black text-xl">
                Q{liveState.currentQuestionIndex + 1}
              </div>
              <div>
                <div className="text-xs uppercase font-bold tracking-wider text-slate-400">
                  Question Progress
                </div>
                <div className="text-lg font-black text-white">
                  {liveState.currentQuestionIndex + 1} of {liveState.totalQuestions}
                </div>
              </div>
            </div>

            {/* Answered counter & timer */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs uppercase font-bold tracking-wider text-slate-400">
                    Responses
                  </div>
                  <div className="text-lg font-black text-white">
                    <span className="text-cyan-400">{liveState.answeredStudentsCount}</span> /{' '}
                    {liveState.connectedStudentsCount}
                  </div>
                </div>
              </div>

              {isRoundOpen && (
                <TimerGauge
                  deadline={deadline}
                  timeLimitSec={liveState.timeLimitSec}
                  onExpire={handleCloseQuestionEarly}
                  size="md"
                />
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              {isRoundOpen ? (
                <button
                  onClick={handleCloseQuestionEarly}
                  className="flex items-center gap-2 rounded-2xl bg-amber-500/20 border border-amber-500/40 px-4 py-3 text-xs font-bold text-amber-300 hover:bg-amber-500/30 active:scale-95 transition-all"
                >
                  <Clock className="h-4 w-4" />
                  <span>Close Question</span>
                </button>
              ) : (
                <button
                  onClick={isLastQuestion ? handleEndQuiz : handleNextQuestion}
                  className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:opacity-95 active:scale-95 transition-all"
                >
                  <span>{isLastQuestion ? 'Reveal Final Podium' : 'Next Question'}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}

              <button
                onClick={handleEndQuiz}
                className="flex items-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-900 px-3.5 py-3 text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-all"
                title="End Quiz Early"
              >
                <StopCircle className="h-4 w-4" />
                <span className="hidden sm:inline">End</span>
              </button>
            </div>
          </div>
        </div>

        {/* Round Summary Pill (when closed) */}
        {!isRoundOpen && liveState.roundSummary && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Round {liveState.currentQuestionIndex + 1} Concluded!
            </span>
            <p className="mt-1 text-sm text-slate-300">
              {liveState.roundSummary.correctCount} of {liveState.roundSummary.totalAnswered} students answered correctly. Check updated rankings below!
            </p>
          </div>
        )}

        {/* Live Leaderboard Display */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white">Live Leaderboard</h2>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              Speed-weighted scoring (up to 1,000 pts / question)
            </span>
          </div>

          <div className="space-y-3">
            {liveState.leaderboard.map((entry, idx) => {
              const medalColor =
                idx === 0
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                  : idx === 1
                  ? 'text-slate-300 bg-slate-400/10 border-slate-400/30'
                  : idx === 2
                  ? 'text-amber-700 bg-amber-800/10 border-amber-700/30'
                  : 'text-slate-400 bg-slate-800 border-slate-700';

              return (
                <div
                  key={entry.participantId}
                  className={`flex items-center justify-between rounded-2xl border p-4 transition-all ${
                    idx === 0
                      ? 'border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-transparent'
                      : 'border-slate-800 bg-slate-950/60'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black border ${medalColor}`}
                    >
                      #{idx + 1}
                    </span>
                    <span className="text-2xl">{entry.avatar}</span>
                    <span className="text-sm font-bold text-white">
                      {entry.displayName}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    {entry.delta > 0 && !isRoundOpen && (
                      <span className="rounded-lg bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                        +{entry.delta}
                      </span>
                    )}
                    <span className="font-mono text-base font-black text-indigo-300">
                      {entry.score.toLocaleString()} pts
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 3. SESSION ENDED / FINAL PODIUM & ANALYTICS (FR-H4S)
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 animate-fade-in">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-300 mb-3">
          <Trophy className="h-4 w-4 text-amber-400" />
          <span>Quiz Complete • Final Results</span>
        </div>
        <h1 className="text-4xl font-black text-white sm:text-5xl">
          Winner Podium
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Congratulations to our top quiz champions!
        </p>
      </div>

      {/* Top 3 Podium Cards */}
      {liveState.leaderboard.length > 0 && (
        <div className="my-10 flex flex-wrap items-end justify-center gap-4 sm:gap-6">
          {/* 2nd Place */}
          {liveState.leaderboard[1] && (
            <div className="flex flex-col items-center rounded-3xl border border-slate-700 bg-slate-900/90 p-6 shadow-xl w-44 text-center order-2 sm:order-1">
              <Medal className="h-8 w-8 text-slate-300 mb-2" />
              <span className="text-3xl mb-1">{liveState.leaderboard[1].avatar}</span>
              <div className="text-sm font-bold text-white truncate w-full">
                {liveState.leaderboard[1].displayName}
              </div>
              <div className="font-mono text-xs font-extrabold text-slate-400 mt-1">
                {liveState.leaderboard[1].score.toLocaleString()} pts
              </div>
              <div className="mt-3 rounded-full bg-slate-800 px-3 py-1 text-xs font-black text-slate-300">
                2nd Place
              </div>
            </div>
          )}

          {/* 1st Place (Champion) */}
          {liveState.leaderboard[0] && (
            <div className="flex flex-col items-center rounded-3xl border-2 border-amber-400 bg-gradient-to-b from-amber-950/40 to-slate-900 p-8 shadow-2xl shadow-amber-500/10 w-52 text-center order-1 sm:order-2 -mt-4">
              <Trophy className="h-12 w-12 text-amber-400 mb-2 animate-bounce" />
              <span className="text-4xl mb-1">{liveState.leaderboard[0].avatar}</span>
              <div className="text-base font-extrabold text-white truncate w-full">
                {liveState.leaderboard[0].displayName}
              </div>
              <div className="font-mono text-sm font-black text-amber-300 mt-1">
                {liveState.leaderboard[0].score.toLocaleString()} pts
              </div>
              <div className="mt-4 rounded-full bg-amber-500 px-4 py-1 text-xs font-black text-slate-950 shadow-md">
                🏆 CHAMPION
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {liveState.leaderboard[2] && (
            <div className="flex flex-col items-center rounded-3xl border border-amber-800/40 bg-slate-900/90 p-6 shadow-xl w-44 text-center order-3">
              <Award className="h-8 w-8 text-amber-700 mb-2" />
              <span className="text-3xl mb-1">{liveState.leaderboard[2].avatar}</span>
              <div className="text-sm font-bold text-white truncate w-full">
                {liveState.leaderboard[2].displayName}
              </div>
              <div className="font-mono text-xs font-extrabold text-slate-400 mt-1">
                {liveState.leaderboard[2].score.toLocaleString()} pts
              </div>
              <div className="mt-3 rounded-full bg-slate-800 px-3 py-1 text-xs font-black text-amber-600">
                3rd Place
              </div>
            </div>
          )}
        </div>
      )}

      {/* Post-Session Questions Review (FR-H4S) */}
      {quiz && (
        <div className="mt-12 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-4 mb-4">
            <BarChart3 className="h-5 w-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-white">
              Post-Session Question Review (FR-H4S)
            </h3>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Now that the session has ended, full question solutions are unlocked for post-quiz review.
          </p>

          <div className="space-y-3">
            {quiz.questions.map((q, idx) => {
              const correctOpt = q.options.find((o) => o.isCorrect);
              return (
                <div
                  key={q.id || idx}
                  className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Question {idx + 1}</span>
                    <span>{q.timeLimitSec}s limit</span>
                  </div>
                  <div className="text-sm font-bold text-white">{q.prompt}</div>
                  <div className="mt-2 text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    Correct Answer: {correctOpt?.text}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-8 flex justify-center">
        <button
          onClick={() => onNavigate('host-dashboard')}
          className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-xs font-bold text-white hover:bg-indigo-500 transition-all"
        >
          <span>Return to Host Studio</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
