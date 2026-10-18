import { Router } from 'express';
import { authenticate, requireHost, requireStudent } from '../middleware/auth';
import { handler, HttpError, parseBody } from '../middleware/error';
import { sessionService } from '../services/session.service';
import {
  answerSubmissionSchema,
  createSessionSchema,
  joinSessionSchema,
} from '../utils/validation';
import { getStorage } from '../storage';

export const sessionRouter = Router();

// ------------------------------------------------------------------ host

sessionRouter.post(
  '/',
  authenticate,
  requireHost,
  handler(async (req, res) => {
    const body = parseBody(createSessionSchema, req.body);
    const session = await sessionService.create(req.auth!.sub, body.quizId);
    res.status(201).json({ session });
  })
);

sessionRouter.get(
  '/',
  authenticate,
  requireHost,
  handler(async (req, res) => {
    res.json({ sessions: await sessionService.listForHost(req.auth!.sub) });
  })
);

/** Host live dashboard bootstrap — leaderboard & controls only (FR-H3S). */
sessionRouter.get(
  '/:id/state',
  authenticate,
  requireHost,
  handler(async (req, res) => {
    const session = await sessionService.getForHost(req.params.id, req.auth!.sub);
    const [hostState, lobby] = await Promise.all([
      sessionService.getHostLiveState(req.params.id),
      sessionService.getLobby(req.params.id),
    ]);
    res.json({ session, hostState, lobby });
  })
);

sessionRouter.post(
  '/:id/start',
  authenticate,
  requireHost,
  handler(async (req, res) => {
    await sessionService.start(req.params.id, req.auth!.sub);
    res.json({ ok: true });
  })
);

sessionRouter.post(
  '/:id/next',
  authenticate,
  requireHost,
  handler(async (req, res) => {
    await sessionService.nextQuestion(req.params.id, req.auth!.sub);
    res.json({ ok: true });
  })
);

sessionRouter.post(
  '/:id/close',
  authenticate,
  requireHost,
  handler(async (req, res) => {
    await sessionService.closeQuestionManually(req.params.id, req.auth!.sub);
    res.json({ ok: true });
  })
);

sessionRouter.post(
  '/:id/end',
  authenticate,
  requireHost,
  handler(async (req, res) => {
    await sessionService.end(req.params.id, req.auth!.sub);
    res.json({ ok: true });
  })
);

/** FR-H4S: full results after the session ends. */
sessionRouter.get(
  '/:id/results',
  authenticate,
  requireHost,
  handler(async (req, res) => {
    res.json({ results: await sessionService.getResults(req.params.id, req.auth!.sub) });
  })
);

// ------------------------------------------------------------------ join flow

/** Public preview used by the join page before entering a name. */
sessionRouter.get(
  '/code/:code',
  handler(async (req, res) => {
    const storage = getStorage();
    const session = await storage.sessions.findActiveByCode(req.params.code);
    if (!session) throw new HttpError(404, 'Session not found or already ended');
    const lobby = await storage.participants.listBySession(session.id);
    const quiz = await storage.quizzes.findById(session.quizId);
    res.json({
      session: {
        id: session.id,
        status: session.status,
        totalQuestions: session.totalQuestions,
        code: session.code,
      },
      quizTitle: quiz?.title ?? 'Live Quiz',
      connectedStudentsCount: lobby.length,
    });
  })
);

/** FR-A2: join with code + display name, no account required. */
sessionRouter.post(
  '/join',
  handler(async (req, res) => {
    const body = parseBody(joinSessionSchema, req.body);
    const { session, participant, token } = await sessionService.join(
      body.code,
      body.displayName ?? 'Player',
      body.avatar ?? '🚀'
    );
    res.status(201).json({
      token,
      participant: { id: participant.id, displayName: participant.displayName, avatar: participant.avatar },
      session: {
        id: session.id,
        status: session.status,
        code: session.code,
        totalQuestions: session.totalQuestions,
        currentQuestionIndex: session.currentQuestionIndex,
      },
    });
  })
);

// ------------------------------------------------------------------ student

/** State sync for lobby / reconnect (never leaks answer keys). */
sessionRouter.get(
  '/:id/student',
  authenticate,
  requireStudent,
  handler(async (req, res) => {
    const auth = req.auth!;
    if (auth.sessionId !== req.params.id) {
      throw new HttpError(403, 'Token does not belong to this session');
    }
    res.json(await sessionService.getStudentState(req.params.id, auth.participantId!));
  })
);

/** REST alternative to the WS `answer:submit` event (FR-S3). */
sessionRouter.post(
  '/:id/answer',
  authenticate,
  requireStudent,
  handler(async (req, res) => {
    const auth = req.auth!;
    if (auth.sessionId !== req.params.id) {
      throw new HttpError(403, 'Token does not belong to this session');
    }
    const body = parseBody(answerSubmissionSchema, req.body);
    const { result, answeredCount } = await sessionService.submitAnswer(
      req.params.id,
      auth.participantId!,
      body.questionId,
      body.optionId
    );
    res.status(201).json({ result, answeredCount });
  })
);
