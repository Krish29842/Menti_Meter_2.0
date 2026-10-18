/**
 * Scoring engine — architecture.md §3.
 *
 * points = round(BASE * (0.5 + 0.5 * time_remaining / time_limit)) if correct, else 0.
 * Ties: higher score → more correct answers → lower cumulative response time.
 */
import type { LeaderboardEntry, Participant } from '../types/domain';

export function computePoints(params: {
  isCorrect: boolean;
  timeRemainingSec: number;
  timeLimitSec: number;
  basePoints: number;
}): number {
  if (!params.isCorrect) return 0;
  const limit = Math.max(1, params.timeLimitSec);
  const ratio = Math.min(1, Math.max(0, params.timeRemainingSec / limit));
  return Math.round(params.basePoints * (0.5 + 0.5 * ratio));
}

export function buildLeaderboard(
  participants: Participant[],
  opts: { includeAnswerStatus?: boolean } = {}
): LeaderboardEntry[] {
  const sorted = [...participants].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.correctAnswersCount !== a.correctAnswersCount)
      return b.correctAnswersCount - a.correctAnswersCount;
    return a.totalResponseTime - b.totalResponseTime;
  });

  return sorted.map((p, idx) => {
    const entry: LeaderboardEntry = {
      participantId: p.id,
      displayName: p.displayName,
      avatar: p.avatar,
      score: p.totalScore,
      rank: idx + 1,
      delta: p.lastDelta,
    };
    if (opts.includeAnswerStatus) entry.isCorrect = p.lastIsCorrect;
    return entry;
  });
}
