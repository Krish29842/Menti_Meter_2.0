import type { LeaderboardEntry, SessionStatus } from './domain';

/** FR-H3S: host live payload carries NO question content and NO answer keys. */
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
  roundSummary?: {
    totalAnswered: number;
    correctCount: number;
    optionDistribution: Record<string, number>;
  };
}

/** Student live payload — never contains isCorrect flags. */
export interface StudentQuestionDTO {
  questionId: string;
  orderIndex: number;
  totalQuestions: number;
  prompt: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  options: {
    id: string;
    text: string;
    imageUrl?: string;
    videoUrl?: string;
  }[];
  timeLimitSec: number;
  deadline: number;
}

export interface StudentAnswerResultDTO {
  questionId: string;
  optionId: string | null;
  isCorrect: boolean;
  pointsEarned: number;
  totalScore: number;
  rank: number;
  answered: boolean;
}
