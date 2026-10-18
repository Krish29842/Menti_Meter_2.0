import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import env from '../config/env';
import { verifyToken, type TokenPayload } from '../services/auth.service';
import { sessionService, type RealtimeEmitter } from '../services/session.service';

type Ack = (response: { ok: boolean; error?: string; status?: number; data?: unknown }) => void;

const sessionRoom = (sessionId: string) => `session:${sessionId}`;
const hostRoom = (sessionId: string) => `session:${sessionId}:host`;
const studentsRoom = (sessionId: string) => `session:${sessionId}:students`;
const participantRoom = (sessionId: string, participantId: string) =>
  `session:${sessionId}:part:${participantId}`;

function emitAckError(ack: Ack | undefined, err: unknown) {
  if (!ack) {
    console.error('[ws] unhandled error:', err);
    return;
  }
  const status = (err as { status?: number })?.status ?? 500;
  ack({
    ok: false,
    status,
    error: err instanceof Error ? err.message : 'Internal error',
  });
}

async function withAck(ack: Ack | undefined, fn: () => Promise<unknown>) {
  try {
    const data = await fn();
    if (ack) ack({ ok: true, data: data as never });
  } catch (err) {
    emitAckError(ack, err);
  }
}

export function attachGateway(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        callback(null, true);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  const emitter: RealtimeEmitter = {
    emitToHost: (sessionId, event, payload) =>
      io.to(hostRoom(sessionId)).emit(event, payload),
    emitToStudents: (sessionId, event, payload) =>
      io.to(studentsRoom(sessionId)).emit(event, payload),
    emitToParticipant: (sessionId, participantId, event, payload) =>
      io.to(participantRoom(sessionId, participantId)).emit(event, payload),
    emitToSession: (sessionId, event, payload) =>
      io.to(sessionRoom(sessionId)).emit(event, payload),
  };
  sessionService.setEmitter(emitter);

  const authFrom = (socket: Socket): TokenPayload | null => {
    const token = socket.handshake.auth?.token;
    if (!token || typeof token !== 'string') return null;
    try {
      return verifyToken(token);
    } catch {
      return null;
    }
  };

  const bindHost = async (socket: Socket, sessionId: string) => {
    const payload = authFrom(socket);
    if (!payload || payload.role !== 'host') {
      throw Object.assign(new Error('Host token required'), { status: 401 });
    }
    await sessionService.getForHost(sessionId, payload.sub);
    await socket.join(hostRoom(sessionId));
    await socket.join(sessionRoom(sessionId));
    socket.data.role = 'host';
    socket.data.sessionId = sessionId;
  };

  const bindStudent = async (socket: Socket, sessionId: string) => {
    const payload = authFrom(socket);
    if (
      !payload ||
      payload.role !== 'student' ||
      payload.sessionId !== sessionId ||
      !payload.participantId
    ) {
      throw Object.assign(new Error('Student token for this session required'), {
        status: 401,
      });
    }
    await socket.join(studentsRoom(sessionId));
    await socket.join(sessionRoom(sessionId));
    await socket.join(participantRoom(sessionId, payload.participantId));
    socket.data.role = 'student';
    socket.data.sessionId = sessionId;
    socket.data.participantId = payload.participantId;
    return payload.participantId;
  };

  io.on('connection', (socket) => {
    // Reconnect fast-path: student tokens carry the session binding.
    const payload = authFrom(socket);
    if (payload?.role === 'student' && payload.sessionId && payload.participantId) {
      void bindStudent(socket, payload.sessionId).catch(() => undefined);
    }

    // -------------------------------------------------------------- host
    socket.on('session:create', ({ quizId } = {}, ack?: Ack) => {
      void withAck(ack, async () => {
        const token = authFrom(socket);
        if (!token || token.role !== 'host') {
          throw Object.assign(new Error('Host token required'), { status: 401 });
        }
        const session = await sessionService.create(token.sub, quizId);
        await socket.join(hostRoom(session.id));
        await socket.join(sessionRoom(session.id));
        socket.data.role = 'host';
        socket.data.sessionId = session.id;
        socket.emit('session:created', { session });
        return { session };
      });
    });

    socket.on('session:bind', ({ sessionId } = {}, ack?: Ack) => {
      void withAck(ack, async () => {
        await bindHost(socket, sessionId);
        const [hostState, lobby] = await Promise.all([
          sessionService.getHostLiveState(sessionId),
          sessionService.getLobby(sessionId),
        ]);
        return { hostState, lobby, session: lobby.session };
      });
    });

    socket.on('session:start', ({ sessionId } = {}, ack?: Ack) => {
      void withAck(ack, async () => {
        const token = authFrom(socket);
        await sessionService.start(sessionId, token?.sub ?? '');
        return { ok: true };
      });
    });

    socket.on('question:next', ({ sessionId } = {}, ack?: Ack) => {
      void withAck(ack, async () => {
        const token = authFrom(socket);
        await sessionService.nextQuestion(sessionId, token?.sub ?? '');
        return { ok: true };
      });
    });

    socket.on('question:close', ({ sessionId } = {}, ack?: Ack) => {
      void withAck(ack, async () => {
        const token = authFrom(socket);
        await sessionService.closeQuestionManually(sessionId, token?.sub ?? '');
        return { ok: true };
      });
    });

    socket.on('session:end', ({ sessionId } = {}, ack?: Ack) => {
      void withAck(ack, async () => {
        const token = authFrom(socket);
        await sessionService.end(sessionId, token?.sub ?? '');
        return { ok: true };
      });
    });

    socket.on('sync:host', ({ sessionId } = {}, ack?: Ack) => {
      void withAck(ack, async () => {
        await sessionService.getForHost(
          sessionId,
          authFrom(socket)?.sub ?? ''
        );
        const [hostState, lobby] = await Promise.all([
          sessionService.getHostLiveState(sessionId),
          sessionService.getLobby(sessionId),
        ]);
        return { hostState, lobby, session: lobby.session };
      });
    });

    // -------------------------------------------------------------- student
    socket.on('session:join', ({ code, displayName, avatar } = {}, ack?: Ack) => {
      void withAck(ack, async () => {
        const { session, participant, token } = await sessionService.join(
          String(code ?? ''),
          String(displayName ?? 'Player'),
          String(avatar ?? '🚀')
        );
        // Issue a scoped student token over the ack (only this socket needs it).
        await socket.join(studentsRoom(session.id));
        await socket.join(sessionRoom(session.id));
        await socket.join(participantRoom(session.id, participant.id));
        socket.data.role = 'student';
        socket.data.sessionId = session.id;
        socket.data.participantId = participant.id;
        socket.data.studentToken = token;
        return { token, participant, session };
      });
    });

    socket.on('session:bind-student', ({ sessionId } = {}, ack?: Ack) => {
      void withAck(ack, async () => {
        const participantId = await bindStudent(socket, sessionId);
        return sessionService.getStudentState(sessionId, participantId);
      });
    });

    socket.on('answer:submit', ({ sessionId, questionId, optionId } = {}, ack?: Ack) => {
      void withAck(ack, async () => {
        const participantId = socket.data.participantId as string | undefined;
        const boundSession = socket.data.sessionId as string | undefined;
        if (!participantId || !boundSession || boundSession !== sessionId) {
          throw Object.assign(new Error('Join the session before answering'), {
            status: 403,
          });
        }
        const { result, answeredCount } = await sessionService.submitAnswer(
          sessionId,
          participantId,
          String(questionId ?? ''),
          String(optionId ?? '')
        );
        return { result, answeredCount };
      });
    });

    socket.on('sync:student', ({ sessionId } = {}, ack?: Ack) => {
      void withAck(ack, async () => {
        const participantId = socket.data.participantId as string | undefined;
        if (!participantId || socket.data.sessionId !== sessionId) {
          throw Object.assign(new Error('Not bound to this session'), { status: 403 });
        }
        return sessionService.getStudentState(sessionId, participantId);
      });
    });
  });

  return io;
}
