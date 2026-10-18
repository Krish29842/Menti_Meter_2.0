export type Role = 'host' | 'student';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  createdAt: number;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface AnswerOption {
  id: string;
  text: string;
  imageUrl?: string;
  videoUrl?: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  quizId: string;
  orderIndex: number;
  prompt: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  options: AnswerOption[];
  timeLimitSec: number;
}

export interface Quiz {
  id: string;
  hostId: string;
  title: string;
  description: string;
  basePoints: number;
  questions: Question[];
  createdAt: number;
  updatedAt: number;
}

export type SessionStatus = 'lobby' | 'question_open' | 'question_closed' | 'ended';

export interface Session {
  id: string;
  quizId: string;
  hostId: string;
  code: string;
  status: SessionStatus;
  currentQuestionIndex: number;
  totalQuestions: number;
  startedAt: number;
  deadline?: number;
  timeLimitSec?: number;
}

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
  totalResponseTime: number;
}

export interface RoundResponse {
  optionId: string;
  submittedAt: number;
  timeRemainingSec: number;
  points: number;
  isCorrect: boolean;
}

export interface SessionResults {
  session: Session;
  quiz: Quiz;
  leaderboard: LeaderboardEntry[];
  perQuestion: {
    questionId: string;
    prompt: string;
    orderIndex: number;
    correctOptionId: string | null;
    totalAnswered: number;
    correctCount: number;
    optionDistribution: Record<string, number>;
  }[];
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
