import type {
  LeaderboardEntry,
  Participant,
  Quiz,
  RoundResponse,
  Session,
  User,
} from '../types/domain';

/** Relational source of truth (PostgreSQL in production, memory in dev). */
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(user: User): Promise<User>;
}

export interface QuizRepository {
  listByHost(hostId: string): Promise<Quiz[]>;
  listAll(): Promise<Quiz[]>;
  findById(id: string): Promise<Quiz | null>;
  create(quiz: Quiz): Promise<Quiz>;
  update(quiz: Quiz): Promise<Quiz>;
  delete(id: string): Promise<void>;
}

export interface SessionRepository {
  create(session: Session): Promise<Session>;
  findById(id: string): Promise<Session | null>;
  findByCode(code: string): Promise<Session | null>;
  listByHost(hostId: string): Promise<Session[]>;
  update(session: Session): Promise<Session>;
  /** Active (non-ended) session for a code — used by join flow. */
  findActiveByCode(code: string): Promise<Session | null>;
}

export interface ParticipantRepository {
  create(participant: Participant): Promise<Participant>;
  findById(id: string): Promise<Participant | null>;
  listBySession(sessionId: string): Promise<Participant[]>;
  update(participant: Participant): Promise<Participant>;
}

/** Ephemeral round state — Redis-backed in production. */
export interface RoundResponseStore {
  set(sessionId: string, participantId: string, response: RoundResponse): Promise<boolean>;
  get(sessionId: string, participantId: string): Promise<RoundResponse | null>;
  all(sessionId: string): Promise<Record<string, RoundResponse>>;
  clear(sessionId: string): Promise<void>;
}

/** Room pub/sub fan-out across pods — Redis pub/sub in production. */
export interface EventBus {
  publish(channel: string, message: unknown): void;
  subscribe(channel: string, handler: (message: unknown) => void): void;
}

export interface StorageBundle {
  users: UserRepository;
  quizzes: QuizRepository;
  sessions: SessionRepository;
  participants: ParticipantRepository;
  roundResponses: RoundResponseStore;
  eventBus: EventBus;
}

export type { LeaderboardEntry };
