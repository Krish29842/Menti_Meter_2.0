export type Role = 'host' | 'student';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface AnswerOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  quizId: string;
  orderIndex: number;
  prompt: string;
  imageUrl?: string;
  audioUrl?: string;
  options: AnswerOption[];
  timeLimitSec: number;
}

export interface Quiz {
  id: string;
  hostId: string;
  title: string;
  description: string;
  basePoints: number; // default 1000
  questions: Question[];
  createdAt: number;
  updatedAt: number;
}

export type SessionStatus = 'lobby' | 'question_open' | 'question_closed' | 'ended';

export interface Participant {
  id: string;
  sessionId: string;
  displayName: string;
  avatar: string;
  totalScore: number;
  joinedAt: number;
  correctAnswersCount: number;
  lastDelta: number;
  lastAnswerOptionId?: string;
  lastIsCorrect?: boolean;
  totalResponseTime: number; // for tie-breaking
}

export interface Session {
  id: string;
  quizId: string;
  hostId: string;
  code: string; // 6-digit session code (e.g. 583-921)
  status: SessionStatus;
  currentQuestionIndex: number;
  totalQuestions: number;
  startedAt?: number;
  deadline?: number; // timestamp when current question closes
  timeLimitSec?: number;
}

export interface StudentAnswerSubmission {
  participantId: string;
  questionId: string;
  optionId: string;
  submittedAt: number;
  timeRemainingSec: number;
}

export interface LeaderboardEntry {
  participantId: string;
  displayName: string;
  avatar: string;
  score: number;
  rank: number;
  delta: number;
  isCorrect?: boolean;
}

// Host Live View DTO: Per FR-H3S, host dashboard receives NO question prompt or student choices during live mode!
export interface HostLiveStateDTO {
  sessionId: string;
  code: string;
  status: SessionStatus;
  currentQuestionIndex: number;
  totalQuestions: number;
  connectedStudentsCount: number;
  answeredStudentsCount: number;
  timeRemainingSec: number;
  timeLimitSec: number;
  leaderboard: LeaderboardEntry[];
  // Round results summary (only after round closes)
  roundSummary?: {
    totalAnswered: number;
    correctCount: number;
    optionDistribution: Record<string, number>; // optionId -> count
  };
}

// Student Live Question DTO (does not contain isCorrect!)
export interface StudentQuestionDTO {
  questionId: string;
  orderIndex: number;
  totalQuestions: number;
  prompt: string;
  imageUrl?: string;
  audioUrl?: string;
  options: { id: string; text: string }[]; // no isCorrect flag sent to student!
  timeLimitSec: number;
  deadline: number;
}
