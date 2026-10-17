import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type {
  LeaderboardEntry,
  Participant,
  SessionStatus,
  StudentQuestionDTO,
} from '../types/quiz';
import { realtimeEngine } from '../services/realtimeEngine';
import { audioService } from '../services/audioEffects';
import { AudioPlayer } from '../components/AudioPlayer';
import { TimerGauge } from '../components/TimerGauge';

interface StudentLiveViewProps {
  participant: Participant;
  sessionId: string;
  onExit: () => void;
}

const OPTION_STYLES = [
  {
    bg: 'bg-rose-600 hover:bg-rose-500',
    selected: 'ring-4 ring-rose-300 bg-rose-500 scale-[1.02]',
    symbol: '▲',
    label: 'Red',
  },
  {
    bg: 'bg-sky-600 hover:bg-sky-500',
    selected: 'ring-4 ring-sky-300 bg-sky-500 scale-[1.02]',
    symbol: '◆',
    label: 'Blue',
  },
  {
    bg: 'bg-amber-600 hover:bg-amber-500',
    selected: 'ring-4 ring-amber-300 bg-amber-500 scale-[1.02]',
    symbol: '●',
    label: 'Yellow',
  },
  {
    bg: 'bg-emerald-600 hover:bg-emerald-500',
    selected: 'ring-4 ring-emerald-300 bg-emerald-500 scale-[1.02]',
    symbol: '■',
    label: 'Green',
  },
  {
    bg: 'bg-purple-600 hover:bg-purple-500',
    selected: 'ring-4 ring-purple-300 bg-purple-500 scale-[1.02]',
    symbol: '✦',
    label: 'Purple',
  },
  {
    bg: 'bg-cyan-600 hover:bg-cyan-500',
    selected: 'ring-4 ring-cyan-300 bg-cyan-500 scale-[1.02]',
    symbol: '★',
    label: 'Teal',
  },
];

export const StudentLiveView: React.FC<StudentLiveViewProps> = ({
  participant: initialParticipant,
  sessionId,
  onExit,
}) => {
  const [participant, setParticipant] = useState<Participant>(initialParticipant);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('lobby');
  const [currentQuestion, setCurrentQuestion] = useState<StudentQuestionDTO | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [deadline, setDeadline] = useState<number>(Date.now());
  const [lastRoundResult, setLastRoundResult] = useState<{
    correctOptionId?: string;
    isCorrect?: boolean;
    deltaPoints?: number;
    currentRank?: number;
  } | null>(null);

  const [finalLeaderboard, setFinalLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const unsub = realtimeEngine.subscribe((msg) => {
      if (msg.sessionId !== sessionId) return;

      if (msg.type === 'SESSION_STARTED') {
        setSessionStatus('question_open');
      } else if (msg.type === 'QUESTION_OPEN') {
        const dto = msg.payload.studentDTO as StudentQuestionDTO;
        setCurrentQuestion(dto);
        setSessionStatus('question_open');
        setSelectedOptionId(null);
        setIsLocked(false);
        setDeadline(msg.payload.deadline);
        setLastRoundResult(null);
      } else if (msg.type === 'QUESTION_CLOSED') {
        setSessionStatus('question_closed');
        const correctOptId = msg.payload.correctOptionId;
        const myEntry = (msg.payload.leaderboard as LeaderboardEntry[])?.find(
          (e) => e.participantId === participant.id
        );

        const isCorrect = selectedOptionId === correctOptId;
        const delta = myEntry?.delta ?? 0;

        setLastRoundResult({
          correctOptionId: correctOptId,
          isCorrect,
          deltaPoints: delta,
          currentRank: myEntry?.rank,
        });

        if (myEntry) {
          setParticipant((prev) => ({
            ...prev,
            totalScore: myEntry.score,
            correctAnswersCount:
              prev.correctAnswersCount + (isCorrect ? 1 : 0),
          }));
        }

        // Sound cues
        if (isCorrect) {
          audioService.playCorrect();
        } else {
          audioService.playWrong();
        }
      } else if (msg.type === 'SESSION_ENDED') {
        setSessionStatus('ended');
        setFinalLeaderboard(msg.payload.finalLeaderboard || []);
        audioService.playFanfare();
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
        });
      }
    });

    return () => unsub();
  }, [sessionId, selectedOptionId, participant.id]);

  const handleSelectOption = (optionId: string) => {
    if (isLocked || sessionStatus !== 'question_open' || !currentQuestion) return;

    setSelectedOptionId(optionId);
    setIsLocked(true);
    audioService.playTick();

    realtimeEngine.submitAnswer(
      sessionId,
      participant.id,
      currentQuestion.questionId,
      optionId
    );
  };

  // 1. LOBBY STATE
  if (sessionStatus === 'lobby') {
    return (
      <div className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-8 text-center bg-slate-950">
        <div className="pointer-events-none absolute h-96 w-96 rounded-full bg-indigo-600/10 blur-[100px]" />

        <div className="relative w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-3xl bg-indigo-600/20 text-5xl border-2 border-indigo-500/40 animate-pulse-ring">
            {participant.avatar}
          </div>

          <h2 className="text-2xl font-black text-white">
            {participant.displayName}
          </h2>
          <p className="mt-1 text-xs font-bold text-indigo-400">
            You're in the game!
          </p>

          <div className="my-8 rounded-2xl bg-slate-950/80 p-4 border border-slate-800/80">
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-300">
              <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping" />
              <span>Waiting for Host to start the quiz...</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Look at the main presentation screen to see everyone joined!
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. ACTIVE QUESTION SCREEN
  if (sessionStatus === 'question_open' && currentQuestion) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {/* Top Info Bar */}
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 shadow-md backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-indigo-500/20 px-2 py-0.5 text-xs font-black text-indigo-300">
              Q{currentQuestion.orderIndex + 1}/{currentQuestion.totalQuestions}
            </span>
            <span className="text-xs font-semibold text-slate-300">
              {participant.displayName}
            </span>
          </div>

          <TimerGauge
            deadline={deadline}
            timeLimitSec={currentQuestion.timeLimitSec}
            size="sm"
          />

          <div className="font-mono text-xs font-black text-indigo-400">
            {participant.totalScore} pts
          </div>
        </div>

        {/* Question Prompt */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6 shadow-2xl backdrop-blur-xl mb-5">
          <h2 className="text-lg sm:text-xl font-black text-white text-center leading-snug">
            {currentQuestion.prompt}
          </h2>

          {/* Image Display */}
          {currentQuestion.imageUrl && (
            <div className="mt-4 flex justify-center max-h-60 overflow-hidden rounded-2xl border border-slate-800 bg-black/40">
              <img
                src={currentQuestion.imageUrl}
                alt="Question Clue"
                className="max-h-60 w-auto object-contain rounded-2xl"
              />
            </div>
          )}

          {/* Audio Player Clue */}
          {currentQuestion.audioUrl && (
            <div className="mt-4">
              <AudioPlayer
                src={currentQuestion.audioUrl}
                autoPlay={true}
                title="Audio Clue"
              />
            </div>
          )}
        </div>

        {/* Answer Options Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {currentQuestion.options.map((opt, i) => {
            const style = OPTION_STYLES[i % OPTION_STYLES.length];
            const isSelected = selectedOptionId === opt.id;

            return (
              <button
                key={opt.id}
                onClick={() => handleSelectOption(opt.id)}
                disabled={isLocked}
                className={`relative flex items-center gap-4 rounded-2xl p-4 sm:p-5 text-left font-bold text-white shadow-xl transition-all active:scale-95 disabled:cursor-not-allowed ${
                  style.bg
                } ${isSelected ? style.selected : isLocked ? 'opacity-40' : ''}`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/25 text-lg font-black text-white">
                  {style.symbol}
                </span>
                <span className="text-base sm:text-lg font-bold leading-tight">
                  {opt.text}
                </span>

                {isSelected && (
                  <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-950 font-bold text-xs shadow-md animate-scale-in">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Locked state alert */}
        {isLocked && (
          <div className="mt-5 rounded-2xl bg-indigo-950/60 border border-indigo-500/30 p-3 text-center text-xs font-bold text-indigo-300 animate-pulse">
            Answer submitted! Waiting for round to close...
          </div>
        )}
      </div>
    );
  }

  // 3. ROUND RESULTS FEEDBACK SCREEN
  if (sessionStatus === 'question_closed' && lastRoundResult) {
    const isCorrect = lastRoundResult.isCorrect;

    return (
      <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-8 bg-slate-950">
        <div
          className={`relative w-full max-w-md rounded-3xl border p-8 shadow-2xl backdrop-blur-xl text-center ${
            isCorrect
              ? 'border-emerald-500/50 bg-gradient-to-b from-emerald-950/40 to-slate-900'
              : 'border-rose-500/50 bg-gradient-to-b from-rose-950/40 to-slate-900'
          }`}
        >
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl">
            {isCorrect ? (
              <CheckCircle2 className="h-16 w-16 text-emerald-400 animate-bounce" />
            ) : (
              <XCircle className="h-16 w-16 text-rose-400" />
            )}
          </div>

          <h2
            className={`text-3xl font-black ${
              isCorrect ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isCorrect ? 'Correct!' : 'Incorrect!'}
          </h2>

          <div className="mt-3 flex items-center justify-center gap-2">
            {isCorrect ? (
              <span className="rounded-xl bg-emerald-500/20 px-3 py-1 font-mono text-lg font-black text-emerald-300 border border-emerald-500/30">
                +{lastRoundResult.deltaPoints || 0} pts
              </span>
            ) : (
              <span className="rounded-xl bg-rose-500/20 px-3 py-1 font-mono text-sm font-bold text-rose-300">
                +0 pts
              </span>
            )}
          </div>

          <div className="mt-6 rounded-2xl bg-slate-950/80 p-4 border border-slate-800">
            <div className="text-xs uppercase font-bold text-slate-400 mb-1">
              Current Standing
            </div>
            <div className="text-xl font-black text-white">
              Rank #{lastRoundResult.currentRank || 1} • {participant.totalScore} pts
            </div>
          </div>

          <p className="mt-6 text-xs text-slate-400">
            Waiting for host to advance to next question...
          </p>
        </div>
      </div>
    );
  }

  // 4. FINAL PODIUM / GAME ENDED SCREEN
  const myFinalRank =
    finalLeaderboard.findIndex((e) => e.participantId === participant.id) + 1;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-8 bg-slate-950">
      <div className="relative w-full max-w-md rounded-3xl border border-amber-500/40 bg-gradient-to-b from-slate-900 to-slate-950 p-8 shadow-2xl backdrop-blur-xl text-center">
        <Trophy className="mx-auto h-16 w-16 text-amber-400 mb-2 animate-bounce" />

        <div className="text-xs font-black uppercase tracking-widest text-amber-400 mb-1">
          Final Results
        </div>
        <h2 className="text-3xl font-black text-white">
          {myFinalRank === 1
            ? '🏆 Champion!'
            : myFinalRank === 2
            ? '🥈 2nd Place!'
            : myFinalRank === 3
            ? '🥉 3rd Place!'
            : `Placed #${myFinalRank}!`}
        </h2>

        <div className="my-6 rounded-2xl bg-slate-900/90 p-4 border border-slate-800">
          <div className="text-3xl mb-1">{participant.avatar}</div>
          <div className="text-lg font-bold text-white">{participant.displayName}</div>
          <div className="font-mono text-2xl font-black text-amber-400 mt-1">
            {participant.totalScore.toLocaleString()} pts
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {participant.correctAnswersCount} correct answers
          </div>
        </div>

        <button
          onClick={onExit}
          className="w-full rounded-2xl bg-indigo-600 py-3.5 text-xs font-bold text-white hover:bg-indigo-500 transition-all"
        >
          Exit to Home
        </button>
      </div>
    </div>
  );
};
