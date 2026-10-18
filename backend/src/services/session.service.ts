import { getStorage } from '../storage';
import type {
  LeaderboardEntry,
  Participant,
  Quiz,
  RoundResponse,
  Session,
  SessionResults,
} from '../types/domain';
import type { HostLiveStateDTO, StudentAnswerResultDTO, StudentQuestionDTO } from '../types/dto';
import { newId, randomSessionCode } from '../utils/ids';
import { signToken } from './auth.service';
import { buildLeaderboard, computePoints } from './scoring';

function httpError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status });
}

/** Decoupled realtime sink — implemented by the Socket.io gateway. */
export interface RealtimeEmitter {
  emitToHost(sessionId: string, event: string, payload: unknown): void;
  emitToStudents(sessionId: string, event: string, payload: unknown): void;
  emitToParticipant(
    sessionId: string,
    participantId: string,
    event: string,
    payload: unknown
  ): void;
  emitToSession(sessionId: string, event: string, payload: unknown): void;
}

interface RoundStats {
  questionId: string;
  prompt: string;
  orderIndex: number;
  correctOptionId: string | null;
  totalAnswered: number;
  correctCount: number;
  optionDistribution: Record<string, number>;
}

const ANSWER_ACCEPT_BUFFER_MS = 300;
const ALL_ANSWERED_CLOSE_DELAY_MS = 500;

class SessionService {
  private emitter: RealtimeEmitter | null = null;
  private timers = new Map<string, NodeJS.Timeout>();
  private roundStats = new Map<string, RoundStats[]>();
  private endScheduled = new Set<string>();

  setEmitter(emitter: RealtimeEmitter) {
    this.emitter = emitter;
  }

  private emit(
    target: 'host' | 'students' | 'session' | 'participant',
    sessionId: string,
    event: string,
    payload: unknown,
    participantId?: string
  ) {
    if (!this.emitter) return;
    if (target === 'host') this.emitter.emitToHost(sessionId, event, payload);
    else if (target === 'students') this.emitter.emitToStudents(sessionId, event, payload);
    else if (target === 'session') this.emitter.emitToSession(sessionId, event, payload);
    else if (participantId)
      this.emitter.emitToParticipant(sessionId, participantId, event, payload);
  }

  // ---------------------------------------------------------------- helpers

  private async getSession(sessionId: string): Promise<Session> {
    const session = await getStorage().sessions.findById(sessionId);
    if (!session) throw httpError(404, 'Session not found');
    return session;
  }

  private async getQuiz(quizId: string): Promise<Quiz> {
    const quiz = await getStorage().quizzes.findById(quizId);
    if (!quiz) throw httpError(404, 'Quiz not found');
    return quiz;
  }

  private clearTimer(sessionId: string) {
    const t = this.timers.get(sessionId);
    if (t) {
      clearTimeout(t);
      this.timers.delete(sessionId);
    }
  }

  // ---------------------------------------------------------------- lifecycle

  /** FR-H1S: start a session → 6-digit code + join link payload. */
  async create(hostId: string, quizId: string): Promise<Session> {
    const storage = getStorage();
    const quiz = await this.getQuiz(quizId);
    if (quiz.hostId !== hostId) throw httpError(403, 'Not your quiz');
    if (quiz.questions.length === 0) throw httpError(400, 'Quiz has no questions');

    let code = randomSessionCode();
    for (let i = 0; i < 50; i++) {
      const clash = await storage.sessions.findByCode(code);
      if (!clash) break;
      code = randomSessionCode();
    }

    const session: Session = {
      id: newId('session'),
      quizId,
      hostId,
      code,
      status: 'lobby',
      currentQuestionIndex: -1,
      totalQuestions: quiz.questions.length,
      startedAt: Date.now(),
    };
    await storage.sessions.create(session);
    this.roundStats.set(session.id, []);

    this.emit('session', session.id, 'session:created', {
      session,
      quizTitle: quiz.title,
    });
    return session;
  }

  // ---------------------------------------------------------------- joining

  /** FR-A2: student joins with session code + display name, no account. */
  async join(
    code: string,
    displayName: string,
    avatar: string
  ): Promise<{ session: Session; participant: Participant; token: string }> {
    const storage = getStorage();
    const session = await storage.sessions.findActiveByCode(code);
    if (!session) throw httpError(404, 'Session not found or already ended');

    const participant: Participant = {
      id: newId('part'),
      sessionId: session.id,
      displayName: displayName.trim() || 'Player',
      avatar: avatar || '🚀',
      totalScore: 0,
      joinedAt: Date.now(),
      correctAnswersCount: 0,
      lastDelta: 0,
      totalResponseTime: 0,
    };
    await storage.participants.create(participant);

    const participants = await storage.participants.listBySession(session.id);

    this.emit(
      'host',
      session.id,
      'student:joined',
      {
        participant: this.publicParticipant(participant),
        connectedStudentsCount: participants.length,
        lobby: participants.map((p) => this.publicParticipant(p)),
        leaderboard: buildLeaderboard(participants),
      }
    );
    this.emit('students', session.id, 'leaderboard:update', {
      leaderboard: buildLeaderboard(participants),
      connectedStudentsCount: participants.length,
    });

    const token = signToken({
      sub: participant.id,
      role: 'student',
      sessionId: session.id,
      participantId: participant.id,
    });
    return { session, participant, token };
  }

  private publicParticipant(p: Participant) {
    return {
      id: p.id,
      displayName: p.displayName,
      avatar: p.avatar,
      totalScore: p.totalScore,
      joinedAt: p.joinedAt,
      correctAnswersCount: p.correctAnswersCount,
      lastDelta: p.lastDelta,
      totalResponseTime: p.totalResponseTime,
    };
  }

  // ---------------------------------------------------------------- host controls

  async start(sessionId: string, hostId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    this.assertHost(session, hostId);
    if (session.status === 'ended') throw httpError(409, 'Session already ended');
    await this.openQuestion(sessionId, 0);
  }

  async nextQuestion(sessionId: string, hostId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    this.assertHost(session, hostId);
    if (session.status === 'ended') throw httpError(409, 'Session already ended');
    const nextIdx = session.currentQuestionIndex + 1;
    if (nextIdx >= session.totalQuestions) {
      await this.end(sessionId, hostId);
      return;
    }
    await this.openQuestion(sessionId, nextIdx);
  }

  async closeQuestionManually(sessionId: string, hostId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    this.assertHost(session, hostId);
    await this.closeQuestion(sessionId);
  }

  async end(sessionId: string, hostId: string): Promise<void> {
    const storage = getStorage();
    const session = await this.getSession(sessionId);
    this.assertHost(session, hostId);
    if (session.status === 'ended') return;

    this.clearTimer(sessionId);
    session.status = 'ended';
    session.deadline = undefined;
    await storage.sessions.update(session);

    const participants = await storage.participants.listBySession(sessionId);
    const quiz = await this.getQuiz(session.quizId);
    const finalLeaderboard = buildLeaderboard(participants, { includeAnswerStatus: true });

    this.emit('host', sessionId, 'session:ended', {
      finalLeaderboard,
      totalQuestions: session.totalQuestions,
      quiz, // FR-H4S: full quiz unlocks for the host after the session ends
      results: await this.buildResults(session, quiz, participants),
    });
    this.emit('students', sessionId, 'session:ended', {
      finalLeaderboard,
      totalQuestions: session.totalQuestions,
    });
  }

  private assertHost(session: Session, hostId: string) {
    if (session.hostId !== hostId) throw httpError(403, 'Only the host can do that');
  }

  // ---------------------------------------------------------------- question flow

  private async openQuestion(sessionId: string, questionIndex: number): Promise<void> {
    const storage = getStorage();
    const session = await this.getSession(sessionId);
    const quiz = await this.getQuiz(session.quizId);

    if (questionIndex >= quiz.questions.length) {
      await this.end(sessionId, session.hostId);
      return;
    }

    const question = quiz.questions[questionIndex];
    const now = Date.now();
    const deadline = now + question.timeLimitSec * 1000;

    session.status = 'question_open';
    session.currentQuestionIndex = questionIndex;
    session.timeLimitSec = question.timeLimitSec;
    session.deadline = deadline;
    await storage.sessions.update(session);

    await storage.roundResponses.clear(sessionId);

    const studentDTO: StudentQuestionDTO = {
      questionId: question.id,
      orderIndex: questionIndex,
      totalQuestions: quiz.questions.length,
      prompt: question.prompt,
      imageUrl: question.imageUrl,
      videoUrl: question.videoUrl,
      audioUrl: question.audioUrl,
      options: question.options.map((o) => ({
        id: o.id,
        text: o.text,
        imageUrl: o.imageUrl,
        videoUrl: o.videoUrl,
      })),
      timeLimitSec: question.timeLimitSec,
      deadline,
    };

    // FR-H3S: host payload is stripped of question content and answer keys.
    const hostDTO = await this.buildHostLiveState(session);

    // FR-H3S: students receive full question content; the host receives the
    // stripped-down live state only (no prompt, options, or answer keys).
    this.emit('students', sessionId, 'question:open', {
      studentDTO,
      questionIndex,
      deadline,
      timeLimitSec: question.timeLimitSec,
    });
    this.emit('host', sessionId, 'question:open', {
      hostDTO,
      questionIndex,
      deadline,
      timeLimitSec: question.timeLimitSec,
    });

    // Server-authoritative timer (FR/anti-cheat §3.7)
    this.clearTimer(sessionId);
    this.timers.set(
      sessionId,
      setTimeout(() => {
        void this.closeQuestion(sessionId);
      }, question.timeLimitSec * 1000 + ANSWER_ACCEPT_BUFFER_MS)
    );
  }

  /** FR-S3: exactly one answer per student per question, only while OPEN. */
  async submitAnswer(
    sessionId: string,
    participantId: string,
    questionId: string,
    optionId: string
  ): Promise<{ result: StudentAnswerResultDTO; answeredCount: number }> {
    const storage = getStorage();
    const session = await this.getSession(sessionId);

    if (session.status !== 'question_open') {
      throw httpError(409, 'Question is not accepting answers');
    }
    if (!session.deadline || Date.now() > session.deadline + ANSWER_ACCEPT_BUFFER_MS) {
      throw httpError(409, 'Time is up for this question');
    }

    const quiz = await this.getQuiz(session.quizId);
    const question = quiz.questions[session.currentQuestionIndex];
    if (!question || question.id !== questionId) {
      throw httpError(409, 'This question is not active');
    }

    const participant = await storage.participants.findById(participantId);
    if (!participant || participant.sessionId !== sessionId) {
      throw httpError(403, 'Not a participant of this session');
    }

    const option = question.options.find((o) => o.id === optionId);
    if (!option) throw httpError(404, 'Option not found');

    const submittedAt = Date.now();
    const timeRemainingSec = Math.max(0, (session.deadline - submittedAt) / 1000);
    const isCorrect = option.isCorrect;
    const points = computePoints({
      isCorrect,
      timeRemainingSec,
      timeLimitSec: question.timeLimitSec,
      basePoints: quiz.basePoints,
    });

    const response: RoundResponse = {
      optionId,
      submittedAt,
      timeRemainingSec,
      points,
      isCorrect,
    };

    // Anti-cheat: duplicate answer → 409 Conflict
    const accepted = await storage.roundResponses.set(sessionId, participantId, response);
    if (!accepted) throw httpError(409, 'You have already answered this question');

    const responseTimeSec = Math.max(0, question.timeLimitSec - timeRemainingSec);
    participant.totalScore += points;
    participant.lastDelta = points;
    participant.lastAnswerOptionId = optionId;
    participant.lastIsCorrect = isCorrect;
    participant.totalResponseTime += responseTimeSec;
    if (isCorrect) participant.correctAnswersCount += 1;
    await storage.participants.update(participant);

    const participants = await storage.participants.listBySession(sessionId);
    const responses = await storage.roundResponses.all(sessionId);
    const answeredCount = Object.keys(responses).length;

    this.emit('session', sessionId, 'leaderboard:update', {
      hostDTO: await this.buildHostLiveState(session),
      leaderboard: buildLeaderboard(participants, {
        includeAnswerStatus: session.status !== 'question_open',
      }),
      answeredCount,
      totalParticipants: participants.length,
    });

    const leaderboard = buildLeaderboard(participants, { includeAnswerStatus: true });
    const entry = leaderboard.find((l) => l.participantId === participantId);
    const result: StudentAnswerResultDTO = {
      questionId,
      optionId,
      isCorrect,
      pointsEarned: points,
      totalScore: participant.totalScore,
      rank: entry?.rank ?? leaderboard.length,
      answered: true,
    };

    // Auto-close once everyone has answered (with a small visual buffer).
    if (participants.length > 0 && answeredCount >= participants.length) {
      if (!this.endScheduled.has(sessionId)) {
        this.endScheduled.add(sessionId);
        setTimeout(() => {
          this.endScheduled.delete(sessionId);
          void this.closeQuestion(sessionId);
        }, ALL_ANSWERED_CLOSE_DELAY_MS);
      }
    }

    return { result, answeredCount };
  }

  private async closeQuestion(sessionId: string): Promise<void> {
    const storage = getStorage();
    const session = await storage.sessions.findById(sessionId);
    if (!session || session.status !== 'question_open') return;

    this.clearTimer(sessionId);

    const quiz = await this.getQuiz(session.quizId);
    const question = quiz.questions[session.currentQuestionIndex];

    const responses = await storage.roundResponses.all(sessionId);
    const optionDistribution: Record<string, number> = {};
    question?.options.forEach((o) => (optionDistribution[o.id] = 0));

    let correctCount = 0;
    for (const res of Object.values(responses)) {
      if (optionDistribution[res.optionId] !== undefined) optionDistribution[res.optionId] += 1;
      if (res.isCorrect) correctCount += 1;
    }

    const correctOptionId = question?.options.find((o) => o.isCorrect)?.id ?? null;
    const stats: RoundStats = {
      questionId: question?.id ?? '',
      prompt: question?.prompt ?? '',
      orderIndex: session.currentQuestionIndex,
      correctOptionId,
      totalAnswered: Object.keys(responses).length,
      correctCount,
      optionDistribution,
    };
    const archive = this.roundStats.get(sessionId) ?? [];
    archive.push(stats);
    this.roundStats.set(sessionId, archive);

    session.status = 'question_closed';
    await storage.sessions.update(session);

    const participants = await storage.participants.listBySession(sessionId);
    const leaderboard = buildLeaderboard(participants, { includeAnswerStatus: true });
    const hostDTO = await this.buildHostLiveState(session, stats);

    // FR-H3S: only counts/distribution cross the wire — never the prompt text
    // (full per-question stats unlock post-session via getResults / FR-H4S).
    const publicSummary = {
      totalAnswered: stats.totalAnswered,
      correctCount: stats.correctCount,
      optionDistribution: stats.optionDistribution,
    };

    this.emit('host', sessionId, 'question:closed', {
      hostDTO,
      leaderboard,
      questionIndex: session.currentQuestionIndex,
      roundSummary: publicSummary,
    });

    // Per-student feedback (FR-S4): correctness, points, rank.
    for (const p of participants) {
      const res = responses[p.id];
      const entry = leaderboard.find((l) => l.participantId === p.id);
      const result: StudentAnswerResultDTO = {
        questionId: stats.questionId,
        optionId: res?.optionId ?? null,
        isCorrect: res?.isCorrect ?? false,
        pointsEarned: res?.points ?? 0,
        totalScore: p.totalScore,
        rank: entry?.rank ?? leaderboard.length,
        answered: Boolean(res),
      };
      this.emit('participant', sessionId, 'question:closed', {
        correctOptionId,
        leaderboard,
        questionIndex: session.currentQuestionIndex,
        yourResult: result,
        roundSummary: {
          totalAnswered: stats.totalAnswered,
          correctCount: stats.correctCount,
          optionDistribution: stats.optionDistribution,
        },
      }, p.id);
    }

    this.emit('host', sessionId, 'leaderboard:update', {
      hostDTO,
      leaderboard,
      answeredCount: stats.totalAnswered,
      totalParticipants: participants.length,
    });
  }

  // ---------------------------------------------------------------- DTO builders

  private async buildHostLiveState(
    session: Session,
    roundSummary?: RoundStats
  ): Promise<HostLiveStateDTO> {
    const participants = await getStorage().participants.listBySession(session.id);
    const responses = await getStorage().roundResponses.all(session.id);
    const now = Date.now();
    const deadline = session.deadline ?? now;

    const dto: HostLiveStateDTO = {
      sessionId: session.id,
      code: session.code,
      status: session.status,
      currentQuestionIndex: session.currentQuestionIndex,
      totalQuestions: session.totalQuestions,
      connectedStudentsCount: participants.length,
      answeredStudentsCount: Object.keys(responses).length,
      timeRemainingSec: Math.max(0, Math.ceil((deadline - now) / 1000)),
      timeLimitSec: session.timeLimitSec ?? 20,
      leaderboard: buildLeaderboard(participants, {
        includeAnswerStatus: session.status !== 'question_open',
      }),
    };
    if (roundSummary) {
      dto.roundSummary = {
        totalAnswered: roundSummary.totalAnswered,
        correctCount: roundSummary.correctCount,
        optionDistribution: roundSummary.optionDistribution,
      };
    }
    return dto;
  }

  // ---------------------------------------------------------------- queries

  async getHostLiveState(sessionId: string): Promise<HostLiveStateDTO> {
    const session = await this.getSession(sessionId);
    const stats =
      session.status === 'question_closed'
        ? (this.roundStats.get(sessionId) ?? []).at(-1)
        : undefined;
    return this.buildHostLiveState(session, stats);
  }

  async getLobby(sessionId: string) {
    const session = await this.getSession(sessionId);
    const participants = await getStorage().participants.listBySession(sessionId);
    const quiz = await this.getQuiz(session.quizId);
    return {
      session,
      quizTitle: quiz.title,
      totalQuestions: session.totalQuestions,
      lobby: participants.map((p) => this.publicParticipant(p)),
      connectedStudentsCount: participants.length,
      leaderboard: buildLeaderboard(participants, { includeAnswerStatus: true }),
    };
  }

  /** State sync for (re)joining students — never leaks answer keys. */
  async getStudentState(sessionId: string, participantId: string) {
    const storage = getStorage();
    const session = await this.getSession(sessionId);
    const participant = await storage.participants.findById(participantId);
    if (!participant || participant.sessionId !== sessionId) {
      throw httpError(403, 'Not a participant of this session');
    }
    const participants = await storage.participants.listBySession(sessionId);
    const leaderboard = buildLeaderboard(participants, {
      includeAnswerStatus: session.status !== 'question_open',
    });

    let question: StudentQuestionDTO | null = null;
    if (session.status === 'question_open' || session.status === 'question_closed') {
      const quiz = await this.getQuiz(session.quizId);
      const q = quiz.questions[session.currentQuestionIndex];
      if (q) {
        question = {
          questionId: q.id,
          orderIndex: session.currentQuestionIndex,
          totalQuestions: quiz.questions.length,
          prompt: q.prompt,
          imageUrl: q.imageUrl,
          videoUrl: q.videoUrl,
          audioUrl: q.audioUrl,
          options: q.options.map((o) => ({
            id: o.id,
            text: o.text,
            imageUrl: o.imageUrl,
            videoUrl: o.videoUrl,
          })),
          timeLimitSec: q.timeLimitSec,
          deadline: session.deadline ?? Date.now(),
        };
      }
    }

    const answered = session.status === 'question_open'
      ? Boolean(await storage.roundResponses.get(sessionId, participantId))
      : true;

    return {
      session: {
        id: session.id,
        status: session.status,
        currentQuestionIndex: session.currentQuestionIndex,
        totalQuestions: session.totalQuestions,
        code: session.code,
      },
      participant: this.publicParticipant(participant),
      leaderboard,
      question: session.status === 'question_open' ? question : null,
      currentResult:
        session.status === 'question_closed'
          ? await this.studentResult(session, participantId)
          : null,
      answered,
    };
  }

  private async studentResult(
    session: Session,
    participantId: string
  ): Promise<StudentAnswerResultDTO | null> {
    const storage = getStorage();
    const participants = await storage.participants.listBySession(session.id);
    const participant = participants.find((p) => p.id === participantId);
    if (!participant) return null;
    const res = await storage.roundResponses.get(session.id, participantId);
    const leaderboard = buildLeaderboard(participants, { includeAnswerStatus: true });
    const quiz = await this.getQuiz(session.quizId);
    const q = quiz.questions[session.currentQuestionIndex];
    return {
      questionId: q?.id ?? '',
      optionId: res?.optionId ?? null,
      isCorrect: res?.isCorrect ?? false,
      pointsEarned: res?.points ?? 0,
      totalScore: participant.totalScore,
      rank: leaderboard.find((l) => l.participantId === participantId)?.rank ?? 0,
      answered: Boolean(res),
    };
  }

  /** FR-H4S: full post-session results (per-question stats, accuracy, breakdown). */
  async getResults(sessionId: string, hostId: string): Promise<SessionResults> {
    const session = await this.getSession(sessionId);
    this.assertHost(session, hostId);
    const quiz = await this.getQuiz(session.quizId);
    const participants = await getStorage().participants.listBySession(sessionId);
    return this.buildResults(session, quiz, participants);
  }

  private async buildResults(
    session: Session,
    quiz: Quiz,
    participants: Participant[]
  ): Promise<SessionResults> {
    return {
      session,
      quiz,
      leaderboard: buildLeaderboard(participants, { includeAnswerStatus: true }),
      perQuestion: this.roundStats.get(session.id) ?? [],
    };
  }

  async listForHost(hostId: string) {
    const sessions = await getStorage().sessions.listByHost(hostId);
    return sessions;
  }

  async getForHost(sessionId: string, hostId: string): Promise<Session> {
    const session = await this.getSession(sessionId);
    this.assertHost(session, hostId);
    return session;
  }
}

export const sessionService = new SessionService();
