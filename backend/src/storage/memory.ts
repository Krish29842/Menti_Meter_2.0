import type {
  Participant,
  Quiz,
  RoundResponse,
  Session,
  User,
} from '../types/domain';
import type {
  EventBus,
  ParticipantRepository,
  QuizRepository,
  RoundResponseStore,
  SessionRepository,
  StorageBundle,
  UserRepository,
} from './interfaces';

class MemoryUserRepository implements UserRepository {
  private rows = new Map<string, User>();

  async findByEmail(email: string): Promise<User | null> {
    const target = email.toLowerCase();
    for (const u of this.rows.values()) {
      if (u.email.toLowerCase() === target) return u;
    }
    return null;
  }

  async findById(id: string): Promise<User | null> {
    return this.rows.get(id) ?? null;
  }

  async create(user: User): Promise<User> {
    this.rows.set(user.id, user);
    return user;
  }
}

class MemoryQuizRepository implements QuizRepository {
  private rows = new Map<string, Quiz>();

  async listByHost(hostId: string): Promise<Quiz[]> {
    return [...this.rows.values()]
      .filter((q) => q.hostId === hostId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async listAll(): Promise<Quiz[]> {
    return [...this.rows.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async findById(id: string): Promise<Quiz | null> {
    return this.rows.get(id) ?? null;
  }

  async create(quiz: Quiz): Promise<Quiz> {
    this.rows.set(quiz.id, quiz);
    return quiz;
  }

  async update(quiz: Quiz): Promise<Quiz> {
    this.rows.set(quiz.id, quiz);
    return quiz;
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }
}

class MemorySessionRepository implements SessionRepository {
  private rows = new Map<string, Session>();

  async create(session: Session): Promise<Session> {
    this.rows.set(session.id, session);
    return session;
  }

  async findById(id: string): Promise<Session | null> {
    return this.rows.get(id) ?? null;
  }

  async findByCode(code: string): Promise<Session | null> {
    const clean = code.replace(/\D/g, '');
    for (const s of this.rows.values()) {
      if (s.code.replace(/\D/g, '') === clean) return s;
    }
    return null;
  }

  async findActiveByCode(code: string): Promise<Session | null> {
    const clean = code.replace(/\D/g, '');
    for (const s of this.rows.values()) {
      if (s.code.replace(/\D/g, '') === clean && s.status !== 'ended') return s;
    }
    return null;
  }

  async listByHost(hostId: string): Promise<Session[]> {
    return [...this.rows.values()]
      .filter((s) => s.hostId === hostId)
      .sort((a, b) => b.startedAt - a.startedAt);
  }

  async update(session: Session): Promise<Session> {
    this.rows.set(session.id, session);
    return session;
  }
}

class MemoryParticipantRepository implements ParticipantRepository {
  private rows = new Map<string, Participant>();

  async create(participant: Participant): Promise<Participant> {
    this.rows.set(participant.id, participant);
    return participant;
  }

  async findById(id: string): Promise<Participant | null> {
    return this.rows.get(id) ?? null;
  }

  async listBySession(sessionId: string): Promise<Participant[]> {
    return [...this.rows.values()]
      .filter((p) => p.sessionId === sessionId)
      .sort((a, b) => a.joinedAt - b.joinedAt);
  }

  async update(participant: Participant): Promise<Participant> {
    this.rows.set(participant.id, participant);
    return participant;
  }
}

class MemoryRoundResponseStore implements RoundResponseStore {
  private rows = new Map<string, Map<string, RoundResponse>>();

  async set(
    sessionId: string,
    participantId: string,
    response: RoundResponse
  ): Promise<boolean> {
    let round = this.rows.get(sessionId);
    if (!round) {
      round = new Map();
      this.rows.set(sessionId, round);
    }
    if (round.has(participantId)) return false; // anti-cheat: 1 answer/question
    round.set(participantId, response);
    return true;
  }

  async get(
    sessionId: string,
    participantId: string
  ): Promise<RoundResponse | null> {
    return this.rows.get(sessionId)?.get(participantId) ?? null;
  }

  async all(sessionId: string): Promise<Record<string, RoundResponse>> {
    const round = this.rows.get(sessionId);
    if (!round) return {};
    return Object.fromEntries(round.entries());
  }

  async clear(sessionId: string): Promise<void> {
    this.rows.delete(sessionId);
  }
}

class MemoryEventBus implements EventBus {
  private handlers = new Map<string, Set<(message: unknown) => void>>();

  publish(channel: string, message: unknown): void {
    this.handlers.get(channel)?.forEach((h) => {
      try {
        h(message);
      } catch {
        // subscriber errors must never break the publisher
      }
    });
  }

  subscribe(channel: string, handler: (message: unknown) => void): void {
    let set = this.handlers.get(channel);
    if (!set) {
      set = new Set();
      this.handlers.set(channel, set);
    }
    set.add(handler);
  }
}

export function createMemoryStorage(): StorageBundle {
  return {
    users: new MemoryUserRepository(),
    quizzes: new MemoryQuizRepository(),
    sessions: new MemorySessionRepository(),
    participants: new MemoryParticipantRepository(),
    roundResponses: new MemoryRoundResponseStore(),
    eventBus: new MemoryEventBus(),
  };
}
