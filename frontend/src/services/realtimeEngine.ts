import type {
  HostLiveStateDTO,
  LeaderboardEntry,
  Participant,
  Question,
  Quiz,
  Session,
  StudentQuestionDTO,
} from '../types/quiz';
import { storageService } from './storage';

export type EventType =
  | 'SESSION_CREATED'
  | 'STUDENT_JOINED'
  | 'SESSION_STARTED'
  | 'QUESTION_OPEN'
  | 'ANSWER_SUBMITTED'
  | 'QUESTION_CLOSED'
  | 'LEADERBOARD_UPDATED'
  | 'SESSION_ENDED'
  | 'PING_SYNC';

export interface NetworkMessage {
  type: EventType;
  sessionId: string;
  payload: any;
  timestamp: number;
}

type Listener = (msg: NetworkMessage) => void;

class RealtimeEngine {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<Listener> = new Set();
  private isHost: boolean = false;

  // Active in-memory session (Host authoritative engine)
  private currentSession: Session | null = null;
  private currentQuiz: Quiz | null = null;
  private participants: Map<string, Participant> = new Map();
  // Question responses: questionId -> Map(participantId, { optionId, submittedAt, points, isCorrect })
  private roundResponses: Map<
    string,
    {
      optionId: string;
      submittedAt: number;
      timeRemainingSec: number;
      points: number;
      isCorrect: boolean;
    }
  > = new Map();

  private questionTimer: any = null;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('quizwave_multiplayer_bus');
      this.channel.onmessage = (event) => {
        const msg = event.data as NetworkMessage;
        this.notifyListeners(msg);
        this.handleIncomingMessage(msg);
      };
    }

    // Also support storage event for cross-origin or older browsers
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'quizwave_last_bus_event' && e.newValue) {
          try {
            const msg = JSON.parse(e.newValue) as NetworkMessage;
            this.notifyListeners(msg);
            this.handleIncomingMessage(msg);
          } catch {
            // ignore
          }
        }
      });
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(msg: NetworkMessage) {
    this.listeners.forEach((l) => l(msg));
  }

  private broadcast(type: EventType, sessionId: string, payload: any) {
    const msg: NetworkMessage = {
      type,
      sessionId,
      payload,
      timestamp: Date.now(),
    };
    // Local notification
    this.notifyListeners(msg);

    // BroadcastChannel
    if (this.channel) {
      this.channel.postMessage(msg);
    }

    // LocalStorage fallback
    try {
      localStorage.setItem('quizwave_last_bus_event', JSON.stringify(msg));
    } catch {
      // ignore
    }
  }

  // --- HOST CONTROLS ---

  public createSession(quizId: string, hostId: string): Session {
    this.isHost = true;
    const quiz = storageService.getQuizById(quizId);
    if (!quiz) throw new Error('Quiz not found');

    this.currentQuiz = quiz;
    this.participants.clear();
    this.roundResponses.clear();

    // Generate formatted 6-digit pin: e.g. "724-819"
    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
    const formattedCode = `${randomPin.substring(0, 3)}-${randomPin.substring(3)}`;

    const session: Session = {
      id: 'session-' + Math.random().toString(36).substring(2, 9),
      quizId,
      hostId,
      code: formattedCode,
      status: 'lobby',
      currentQuestionIndex: -1,
      totalQuestions: quiz.questions.length,
      startedAt: Date.now(),
    };

    this.currentSession = session;
    this.saveSessionState(session);

    this.broadcast('SESSION_CREATED', session.id, {
      session,
      quizTitle: quiz.title,
    });

    return session;
  }

  public getSessionByCode(code: string): Session | null {
    const clean = code.replace(/\D/g, '');
    const sessions = this.getAllSavedSessions();
    return (
      sessions.find(
        (s) => s.code.replace(/\D/g, '') === clean && s.status !== 'ended'
      ) || null
    );
  }

  public getSessionById(sessionId: string): Session | null {
    if (this.currentSession && this.currentSession.id === sessionId) {
      return this.currentSession;
    }
    const saved = localStorage.getItem(`quizwave_session_${sessionId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  }

  public startSession(sessionId: string): void {
    if (!this.currentSession || this.currentSession.id !== sessionId) return;

    this.currentSession.status = 'question_open';
    this.currentSession.currentQuestionIndex = 0;
    this.saveSessionState(this.currentSession);

    this.broadcast('SESSION_STARTED', sessionId, {
      currentQuestionIndex: 0,
      totalQuestions: this.currentSession.totalQuestions,
    });

    this.openQuestion(0);
  }

  public openQuestion(questionIndex: number): void {
    if (!this.currentSession || !this.currentQuiz) return;
    if (questionIndex >= this.currentQuiz.questions.length) {
      this.endSession(this.currentSession.id);
      return;
    }

    const question: Question = this.currentQuiz.questions[questionIndex];
    this.currentSession.status = 'question_open';
    this.currentSession.currentQuestionIndex = questionIndex;
    this.currentSession.timeLimitSec = question.timeLimitSec;
    const deadline = Date.now() + question.timeLimitSec * 1000;
    this.currentSession.deadline = deadline;

    this.roundResponses.clear();
    this.saveSessionState(this.currentSession);

    // 1. Student DTO (NO isCorrect property!)
    const studentDTO: StudentQuestionDTO = {
      questionId: question.id,
      orderIndex: questionIndex,
      totalQuestions: this.currentQuiz.questions.length,
      prompt: question.prompt,
      imageUrl: question.imageUrl,
      audioUrl: question.audioUrl,
      options: question.options.map((o) => ({ id: o.id, text: o.text })),
      timeLimitSec: question.timeLimitSec,
      deadline,
    };

    // 2. Host DTO (FR-H3S: HOST SEES ONLY LEADERBOARD / STATS, NOT QUESTION CONTENT!)
    const hostDTO: HostLiveStateDTO = this.buildHostLiveState();

    this.broadcast('QUESTION_OPEN', this.currentSession.id, {
      studentDTO,
      hostDTO,
      questionIndex,
      deadline,
      timeLimitSec: question.timeLimitSec,
    });

    // Server-authoritative timer
    if (this.questionTimer) clearTimeout(this.questionTimer);
    this.questionTimer = setTimeout(() => {
      this.closeQuestion();
    }, question.timeLimitSec * 1000 + 300); // 300ms buffer
  }

  public closeQuestion(): void {
    if (!this.currentSession || this.currentSession.status !== 'question_open') {
      return;
    }
    if (this.questionTimer) {
      clearTimeout(this.questionTimer);
      this.questionTimer = null;
    }

    this.currentSession.status = 'question_closed';
    this.saveSessionState(this.currentSession);

    // Compute round statistics
    const currentQuestion = this.currentQuiz?.questions[
      this.currentSession.currentQuestionIndex
    ];
    const optionDistribution: Record<string, number> = {};
    if (currentQuestion) {
      currentQuestion.options.forEach((opt) => {
        optionDistribution[opt.id] = 0;
      });
    }

    let correctCount = 0;
    this.roundResponses.forEach((res) => {
      if (optionDistribution[res.optionId] !== undefined) {
        optionDistribution[res.optionId]++;
      }
      if (res.isCorrect) {
        correctCount++;
      }
    });

    const hostDTO = this.buildHostLiveState();
    hostDTO.roundSummary = {
      totalAnswered: this.roundResponses.size,
      correctCount,
      optionDistribution,
    };

    const leaderboard = this.calculateLeaderboard();

    this.broadcast('QUESTION_CLOSED', this.currentSession.id, {
      hostDTO,
      leaderboard,
      correctOptionId: currentQuestion?.options.find((o) => o.isCorrect)?.id,
      questionIndex: this.currentSession.currentQuestionIndex,
      roundSummary: hostDTO.roundSummary,
    });
  }

  public nextQuestion(): void {
    if (!this.currentSession || !this.currentQuiz) return;
    const nextIdx = this.currentSession.currentQuestionIndex + 1;
    if (nextIdx >= this.currentQuiz.questions.length) {
      this.endSession(this.currentSession.id);
    } else {
      this.openQuestion(nextIdx);
    }
  }

  public endSession(sessionId: string): void {
    if (!this.currentSession || this.currentSession.id !== sessionId) return;

    if (this.questionTimer) {
      clearTimeout(this.questionTimer);
      this.questionTimer = null;
    }

    this.currentSession.status = 'ended';
    this.saveSessionState(this.currentSession);

    const finalLeaderboard = this.calculateLeaderboard();

    this.broadcast('SESSION_ENDED', sessionId, {
      finalLeaderboard,
      totalQuestions: this.currentSession.totalQuestions,
      quiz: this.currentQuiz, // full quiz stats available after session ends (FR-H4S)
    });
  }

  // --- STUDENT CONTROLS ---

  public joinSession(
    sessionId: string,
    displayName: string,
    avatar: string
  ): Participant {
    const participant: Participant = {
      id: 'part-' + Math.random().toString(36).substring(2, 9),
      sessionId,
      displayName: displayName.trim() || 'Player',
      avatar: avatar || '🚀',
      totalScore: 0,
      joinedAt: Date.now(),
      correctAnswersCount: 0,
      lastDelta: 0,
      totalResponseTime: 0,
    };

    this.broadcast('STUDENT_JOINED', sessionId, { participant });

    return participant;
  }

  public submitAnswer(
    sessionId: string,
    participantId: string,
    questionId: string,
    optionId: string
  ): void {
    const submittedAt = Date.now();
    this.broadcast('ANSWER_SUBMITTED', sessionId, {
      participantId,
      questionId,
      optionId,
      submittedAt,
    });
  }

  // Add simulated bot students for easy 1-click testing by the host!
  public addDemoBotStudents(sessionId: string, count: number = 3): void {
    const botNames = [
      { name: 'Maya Explorer', avatar: '🦁' },
      { name: 'Liam Rocket', avatar: '🚀' },
      { name: 'Sophia Spark', avatar: '⚡' },
      { name: 'Ethan Fox', avatar: '🦊' },
      { name: 'Chloe Panda', avatar: '🐼' },
      { name: 'Lucas Comet', avatar: '☄️' },
    ];

    const toAdd = botNames.slice(0, count);
    toAdd.forEach((b) => {
      this.joinSession(sessionId, b.name, b.avatar);
    });
  }

  // --- INTERNAL MESSAGE HANDLING (Host-Authoritative logic) ---

  private handleIncomingMessage(msg: NetworkMessage) {
    if (msg.type === 'STUDENT_JOINED') {
      const p = msg.payload.participant as Participant;
      if (p) {
        this.participants.set(p.id, p);
        if (this.isHost && this.currentSession) {
          const lb = this.calculateLeaderboard();
          this.broadcast('LEADERBOARD_UPDATED', msg.sessionId, {
            leaderboard: lb,
            connectedStudentsCount: this.participants.size,
          });
        }
      }
    } else if (msg.type === 'ANSWER_SUBMITTED' && this.isHost) {
      if (!this.currentSession || this.currentSession.status !== 'question_open') {
        return;
      }
      const { participantId, optionId, submittedAt } = msg.payload;
      const participant = this.participants.get(participantId);
      if (!participant) return;

      // Anti-cheat: 1 answer per question
      if (this.roundResponses.has(participantId)) return;

      const currentQ = this.currentQuiz?.questions[
        this.currentSession.currentQuestionIndex
      ];
      if (!currentQ) return;

      const chosenOption = currentQ.options.find((o) => o.id === optionId);
      const isCorrect = chosenOption ? chosenOption.isCorrect : false;

      // Architecture formula:
      // points = round(BASE * (0.5 + 0.5 * (time_remaining / time_limit))) if correct, else 0
      const deadline = this.currentSession.deadline || submittedAt;
      const timeRemainingMs = Math.max(0, deadline - submittedAt);
      const timeRemainingSec = timeRemainingMs / 1000;
      const timeLimitSec = currentQ.timeLimitSec || 20;
      const basePoints = this.currentQuiz?.basePoints || 1000;

      let pointsAwarded = 0;
      if (isCorrect) {
        const speedRatio = Math.min(1, Math.max(0, timeRemainingSec / timeLimitSec));
        pointsAwarded = Math.round(basePoints * (0.5 + 0.5 * speedRatio));
      }

      const responseTimeSec = Math.max(0, timeLimitSec - timeRemainingSec);
      participant.totalScore += pointsAwarded;
      participant.lastDelta = pointsAwarded;
      participant.lastAnswerOptionId = optionId;
      participant.lastIsCorrect = isCorrect;
      participant.totalResponseTime += responseTimeSec;
      if (isCorrect) {
        participant.correctAnswersCount++;
      }

      this.roundResponses.set(participantId, {
        optionId,
        submittedAt,
        timeRemainingSec,
        points: pointsAwarded,
        isCorrect,
      });

      // Broadcast live answered counter update
      const hostDTO = this.buildHostLiveState();
      this.broadcast('LEADERBOARD_UPDATED', this.currentSession.id, {
        hostDTO,
        leaderboard: this.calculateLeaderboard(),
        answeredCount: this.roundResponses.size,
        totalParticipants: this.participants.size,
      });

      // If all participants have answered, auto-close round!
      if (
        this.participants.size > 0 &&
        this.roundResponses.size >= this.participants.size
      ) {
        setTimeout(() => {
          this.closeQuestion();
        }, 500);
      }
    }
  }

  // --- SCORING & LEADERBOARD HELPERS ---

  private calculateLeaderboard(): LeaderboardEntry[] {
    const list = Array.from(this.participants.values());
    // Tie-breaking: 1) totalScore descending, 2) correctAnswersCount descending, 3) totalResponseTime ascending
    list.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.correctAnswersCount !== a.correctAnswersCount)
        return b.correctAnswersCount - a.correctAnswersCount;
      return a.totalResponseTime - b.totalResponseTime;
    });

    return list.map((p, idx) => ({
      participantId: p.id,
      displayName: p.displayName,
      avatar: p.avatar,
      score: p.totalScore,
      rank: idx + 1,
      delta: p.lastDelta,
      isCorrect: p.lastIsCorrect,
    }));
  }

  private buildHostLiveState(): HostLiveStateDTO {
    const deadline = this.currentSession?.deadline || Date.now();
    const remainingMs = Math.max(0, deadline - Date.now());
    const remainingSec = Math.ceil(remainingMs / 1000);

    return {
      sessionId: this.currentSession?.id || '',
      code: this.currentSession?.code || '',
      status: this.currentSession?.status || 'lobby',
      currentQuestionIndex: this.currentSession?.currentQuestionIndex ?? -1,
      totalQuestions: this.currentSession?.totalQuestions || 0,
      connectedStudentsCount: this.participants.size,
      answeredStudentsCount: this.roundResponses.size,
      timeRemainingSec: remainingSec,
      timeLimitSec: this.currentSession?.timeLimitSec || 20,
      leaderboard: this.calculateLeaderboard(),
    };
  }

  private saveSessionState(session: Session) {
    try {
      localStorage.setItem(
        `quizwave_session_${session.id}`,
        JSON.stringify(session)
      );
      const all = this.getAllSavedSessions().filter((s) => s.id !== session.id);
      all.push(session);
      localStorage.setItem('quizwave_sessions_index', JSON.stringify(all));
    } catch {
      // ignore
    }
  }

  private getAllSavedSessions(): Session[] {
    const raw = localStorage.getItem('quizwave_sessions_index');
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
}

export const realtimeEngine = new RealtimeEngine();
