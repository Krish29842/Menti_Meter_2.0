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
import {
  API_URL,
  detectMode,
  getHostToken,
  sessionApi,
  setStudentToken,
} from './api';
import { io, type Socket } from 'socket.io-client';

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

// ===========================================================================
// LOCAL ENGINE — BroadcastChannel multi-tab simulation (offline fallback)
// ===========================================================================

class LocalRealtimeEngine {
  private channel: BroadcastChannel | null = null;
  private onNotify: ((msg: NetworkMessage) => void) | null = null;
  private isHost: boolean = false;

  private currentSession: Session | null = null;
  private currentQuiz: Quiz | null = null;
  private participants: Map<string, Participant> = new Map();
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

  public setNotifier(fn: (msg: NetworkMessage) => void) {
    this.onNotify = fn;
  }

  private notifyListeners(msg: NetworkMessage) {
    this.onNotify?.(msg);
  }

  private broadcast(type: EventType, sessionId: string, payload: any) {
    const msg: NetworkMessage = {
      type,
      sessionId,
      payload,
      timestamp: Date.now(),
    };
    this.notifyListeners(msg);

    if (this.channel) {
      this.channel.postMessage(msg);
    }

    try {
      localStorage.setItem('quizwave_last_bus_event', JSON.stringify(msg));
    } catch {
      // ignore
    }
  }

  // --- HOST CONTROLS ---

  public createSession(quizId: string, hostId: string): Session {
    this.isHost = true;
    const quiz = storageService.getCachedQuizById(quizId);
    if (!quiz) throw new Error('Quiz not found');

    this.currentQuiz = quiz;
    this.participants.clear();
    this.roundResponses.clear();

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

    const studentDTO: StudentQuestionDTO = {
      questionId: question.id,
      orderIndex: questionIndex,
      totalQuestions: this.currentQuiz.questions.length,
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

    const hostDTO: HostLiveStateDTO = this.buildHostLiveState();

    this.broadcast('QUESTION_OPEN', this.currentSession.id, {
      studentDTO,
      hostDTO,
      questionIndex,
      deadline,
      timeLimitSec: question.timeLimitSec,
    });

    if (this.questionTimer) clearTimeout(this.questionTimer);
    this.questionTimer = setTimeout(() => {
      this.closeQuestion();
    }, question.timeLimitSec * 1000 + 300);
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
      quiz: this.currentQuiz,
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

      if (this.roundResponses.has(participantId)) return;

      const currentQ = this.currentQuiz?.questions[
        this.currentSession.currentQuestionIndex
      ];
      if (!currentQ) return;

      const chosenOption = currentQ.options.find((o) => o.id === optionId);
      const isCorrect = chosenOption ? chosenOption.isCorrect : false;

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

      const hostDTO = this.buildHostLiveState();
      this.broadcast('LEADERBOARD_UPDATED', this.currentSession.id, {
        hostDTO,
        leaderboard: this.calculateLeaderboard(),
        answeredCount: this.roundResponses.size,
        totalParticipants: this.participants.size,
      });

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

export const localRealtimeEngine = new LocalRealtimeEngine();

// ===========================================================================
// REMOTE ENGINE — Socket.io gateway on the QuizWave backend
// ===========================================================================

const DEMO_BOTS = [
  { name: 'Maya Explorer', avatar: '🦁' },
  { name: 'Liam Rocket', avatar: '🚀' },
  { name: 'Sophia Spark', avatar: '⚡' },
  { name: 'Ethan Fox', avatar: '🦊' },
  { name: 'Chloe Panda', avatar: '🐼' },
  { name: 'Lucas Comet', avatar: '☄️' },
];

class RemoteRealtimeEngine {
  private socket: Socket | null = null;
  private currentSessionId: string | null = null;
  private botTokens: string[] = [];
  private onNotify: ((msg: NetworkMessage) => void) | null = null;

  public setNotifier(fn: (msg: NetworkMessage) => void) {
    this.onNotify = fn;
  }

  private notify(type: EventType, payload: any, sessionId?: string) {
    const msg: NetworkMessage = {
      type,
      sessionId: sessionId || this.currentSessionId || '',
      payload,
      timestamp: Date.now(),
    };
    this.onNotify?.(msg);
  }

  private async ensureSocket(token: string | null): Promise<Socket> {
    if (this.socket?.connected) return this.socket;
    this.socket?.disconnect();
    this.socket = io(API_URL, {
      auth: token ? { token } : {},
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    });

    this.socket.on('session:created', (payload: any) => {
      this.currentSessionId = payload.session.id;
      this.notify('SESSION_CREATED', payload, payload.session.id);
    });
    this.socket.on('student:joined', (payload: any) => {
      this.notify('STUDENT_JOINED', payload);
      this.notify('LEADERBOARD_UPDATED', {
        leaderboard: payload.leaderboard,
        totalParticipants: payload.connectedStudentsCount,
        answeredCount: 0,
      });
    });
    this.socket.on('question:open', (payload: any) => {
      if (payload.hostDTO && !payload.studentDTO) {
        // Host channel — FR-H3S stripped payload
        this.notify('QUESTION_OPEN', payload);
        this.notify('SESSION_STARTED', {
          currentQuestionIndex: payload.questionIndex,
          totalQuestions: payload.hostDTO.totalQuestions,
        });
      }
      if (payload.studentDTO) {
        // Student channel — full question (no answer keys)
        this.notify('QUESTION_OPEN', payload);
        this.notify('SESSION_STARTED', {
          currentQuestionIndex: payload.questionIndex,
          totalQuestions: payload.studentDTO.totalQuestions,
        });
        this.scheduleBotAnswers(payload.studentDTO);
      }
    });
    this.socket.on('leaderboard:update', (payload: any) => {
      this.notify('LEADERBOARD_UPDATED', payload);
    });
    this.socket.on('question:closed', (payload: any) => {
      this.notify('QUESTION_CLOSED', payload);
    });
    this.socket.on('session:ended', (payload: any) => {
      this.botTokens = [];
      this.notify('SESSION_ENDED', payload);
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Socket connection timeout')), 8000);
      this.socket!.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
      this.socket!.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    return this.socket;
  }

  private emitAck(event: string, payload: unknown): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('Socket not connected'));
      const timeout = setTimeout(
        () => reject(new Error(`Timed out waiting for ${event}`)),
        10000
      );
      this.socket.emit(event, payload, (response: any) => {
        clearTimeout(timeout);
        if (response?.ok) resolve(response.data);
        else reject(Object.assign(new Error(response?.error || 'Request failed'), {
          status: response?.status || 500,
        }));
      });
    });
  }

  /** Demo bots answer automatically with random options after joining. */
  private scheduleBotAnswers(dto: StudentQuestionDTO) {
    if (this.botTokens.length === 0 || !this.currentSessionId) return;
    const sessionId = this.currentSessionId;
    this.botTokens.forEach((token, i) => {
      const delay =
        (0.2 + Math.random() * 0.55) * dto.timeLimitSec * 1000 + i * 150;
      setTimeout(() => {
        const option =
          dto.options[Math.floor(Math.random() * dto.options.length)];
        sessionApi
          .answer(sessionId, dto.questionId, option.id, token)
          .catch(() => undefined);
      }, delay);
    });
  }

  // ---- host-side operations ----

  async createSession(quizId: string): Promise<Session> {
    const hostToken = getHostToken();
    if (!hostToken) {
      throw Object.assign(new Error('Host login required'), { status: 401 });
    }
    const { session } = await sessionApi.create(quizId);
    this.currentSessionId = session.id;
    this.botTokens = [];
    await this.ensureSocket(hostToken);
    this.notify(
      'SESSION_CREATED',
      { session, quizTitle: undefined },
      session.id
    );
    return session;
  }

  async bindHost(sessionId: string): Promise<{
    hostState: HostLiveStateDTO;
    lobby: { lobby: Participant[]; connectedStudentsCount: number };
    session: Session;
  }> {
    const hostToken = getHostToken();
    if (!hostToken) throw Object.assign(new Error('Host login required'), { status: 401 });
    this.currentSessionId = sessionId;
    await this.ensureSocket(hostToken);
    const data = await this.emitAck('session:bind', { sessionId });
    return data;
  }

  async getSessionById(sessionId: string): Promise<Session | null> {
    try {
      const { session } = await sessionApi.state(sessionId);
      return session;
    } catch {
      return null;
    }
  }

  async startSession(sessionId: string) {
    this.currentSessionId = sessionId;
    await this.emitAck('session:start', { sessionId });
  }

  async nextQuestion(sessionId: string) {
    await this.emitAck('question:next', { sessionId });
  }

  async closeQuestion(sessionId: string) {
    await this.emitAck('question:close', { sessionId });
  }

  async endSession(sessionId: string) {
    await this.emitAck('session:end', { sessionId });
  }

  // ---- student-side operations ----

  async getSessionByCode(code: string): Promise<Session | null> {
    try {
      const { session } = await sessionApi.codePreview(code);
      return session;
    } catch {
      return null;
    }
  }

  async joinByCode(
    code: string,
    displayName: string,
    avatar: string
  ): Promise<{ participant: Participant; session: Session }> {
    const { token, participant, session } = await sessionApi.join(
      code,
      displayName,
      avatar
    );
    setStudentToken(token);
    this.currentSessionId = session.id;
    await this.ensureSocket(token);

    // Late join / reconnect: sync current question state (no answer keys).
    try {
      const state = await sessionApi.studentState(session.id);
      if (
        state.session?.status === 'question_open' &&
        state.question &&
        !state.answered
      ) {
        this.notify('QUESTION_OPEN', {
          studentDTO: state.question,
          questionIndex: state.question.orderIndex,
          deadline: state.question.deadline,
          timeLimitSec: state.question.timeLimitSec,
        });
      }
      if (state.leaderboard) {
        this.notify('LEADERBOARD_UPDATED', {
          leaderboard: state.leaderboard,
          totalParticipants: state.leaderboard.length,
        });
      }
    } catch {
      // state sync is best-effort
    }

    return { participant: participant as Participant, session };
  }

  async submitAnswer(
    sessionId: string,
    _participantId: string,
    questionId: string,
    optionId: string
  ) {
    try {
      await this.emitAck('answer:submit', { sessionId, questionId, optionId });
    } catch (err: any) {
      // Duplicate / closed answers are expected races — swallow silently.
      if (err?.status !== 409) throw err;
    }
  }

  async addDemoBotStudents(count: number = 4) {
    const bots = DEMO_BOTS.slice(0, count);
    for (const bot of bots) {
      try {
        const { token } = await sessionApi.join(
          (await this.codeForCurrentSession()) || '',
          bot.name,
          bot.avatar
        );
        this.botTokens.push(token);
      } catch {
        // ignore individual bot failures
      }
    }
  }

  private async codeForCurrentSession(): Promise<string | null> {
    if (!this.currentSessionId) return null;
    const s = await this.getSessionById(this.currentSessionId);
    return s?.code ?? null;
  }
}

const remoteEngine = new RemoteRealtimeEngine();

// ===========================================================================
// FACADE — remote (backend) first, local simulation as automatic fallback
// ===========================================================================

class RealtimeFacade {
  private listeners: Set<Listener> = new Set();

  constructor() {
    localRealtimeEngine.setNotifier((msg) => this.dispatch(msg));
    remoteEngine.setNotifier((msg) => this.dispatch(msg));
  }

  private dispatch(msg: NetworkMessage) {
    this.listeners.forEach((l) => {
      try {
        l(msg);
      } catch (err) {
        console.error('[realtime] listener error', err);
      }
    });
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async remote(): Promise<boolean> {
    return (await detectMode()) === 'remote';
  }

  // ---- host ----

  async createSession(quizId: string, hostId: string): Promise<Session> {
    if (await this.remote()) {
      return remoteEngine.createSession(quizId);
    }
    return localRealtimeEngine.createSession(quizId, hostId);
  }

  async bindHost(sessionId: string) {
    if (await this.remote()) {
      return remoteEngine.bindHost(sessionId);
    }
    return null;
  }

  async getSessionById(sessionId: string): Promise<Session | null> {
    if (await this.remote()) {
      return remoteEngine.getSessionById(sessionId);
    }
    return localRealtimeEngine.getSessionById(sessionId);
  }

  async startSession(sessionId: string): Promise<void> {
    if (await this.remote()) {
      return remoteEngine.startSession(sessionId);
    }
    return localRealtimeEngine.startSession(sessionId);
  }

  async nextQuestion(sessionId: string): Promise<void> {
    if (await this.remote()) {
      return remoteEngine.nextQuestion(sessionId);
    }
    return localRealtimeEngine.nextQuestion();
  }

  async closeQuestion(sessionId: string): Promise<void> {
    if (await this.remote()) {
      return remoteEngine.closeQuestion(sessionId);
    }
    return localRealtimeEngine.closeQuestion();
  }

  async endSession(sessionId: string): Promise<void> {
    if (await this.remote()) {
      return remoteEngine.endSession(sessionId);
    }
    return localRealtimeEngine.endSession(sessionId);
  }

  async addDemoBotStudents(sessionId: string, count: number = 4): Promise<void> {
    if (await this.remote()) {
      return remoteEngine.addDemoBotStudents(count);
    }
    return localRealtimeEngine.addDemoBotStudents(sessionId, count);
  }

  // ---- student ----

  async getSessionByCode(code: string): Promise<Session | null> {
    if (await this.remote()) {
      return remoteEngine.getSessionByCode(code);
    }
    return localRealtimeEngine.getSessionByCode(code);
  }

  async joinByCode(
    code: string,
    displayName: string,
    avatar: string
  ): Promise<{ participant: Participant; session: Session }> {
    if (await this.remote()) {
      return remoteEngine.joinByCode(code, displayName, avatar);
    }
    const session = localRealtimeEngine.getSessionByCode(code);
    if (!session) {
      throw new Error('No active session found with this PIN.');
    }
    const participant = localRealtimeEngine.joinSession(
      session.id,
      displayName,
      avatar
    );
    return { participant, session };
  }

  async submitAnswer(
    sessionId: string,
    participantId: string,
    questionId: string,
    optionId: string
  ): Promise<void> {
    if (await this.remote()) {
      return remoteEngine.submitAnswer(sessionId, participantId, questionId, optionId);
    }
    return localRealtimeEngine.submitAnswer(
      sessionId,
      participantId,
      questionId,
      optionId
    );
  }
}

export const realtimeEngine = new RealtimeFacade();
