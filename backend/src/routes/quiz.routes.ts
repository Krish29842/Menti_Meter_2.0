import { Router } from 'express';
import { authenticate, requireHost } from '../middleware/auth';
import { handler, parseBody } from '../middleware/error';
import { quizService } from '../services/quiz.service';
import { quizInputSchema, quizUpdateSchema, reorderSchema } from '../utils/validation';

export const quizRouter = Router();

quizRouter.use(authenticate, requireHost);

quizRouter.get(
  '/',
  handler(async (req, res) => {
    res.json({ quizzes: await quizService.list(req.auth!.sub) });
  })
);

quizRouter.post(
  '/',
  handler(async (req, res) => {
    const body = parseBody(quizInputSchema, req.body);
    res.status(201).json({ quiz: await quizService.create(req.auth!.sub, body) });
  })
);

quizRouter.get(
  '/:id',
  handler(async (req, res) => {
    res.json({ quiz: await quizService.get(req.auth!.sub, req.params.id) });
  })
);

quizRouter.put(
  '/:id',
  handler(async (req, res) => {
    const body = parseBody(quizUpdateSchema, req.body);
    res.json({ quiz: await quizService.update(req.auth!.sub, req.params.id, body) });
  })
);

quizRouter.delete(
  '/:id',
  handler(async (req, res) => {
    await quizService.remove(req.auth!.sub, req.params.id);
    res.status(204).end();
  })
);

/** FR-H1: duplicate a quiz. */
quizRouter.post(
  '/:id/duplicate',
  handler(async (req, res) => {
    res.status(201).json({ quiz: await quizService.duplicate(req.auth!.sub, req.params.id) });
  })
);

/** FR-H3: reorder questions. */
quizRouter.put(
  '/:id/reorder',
  handler(async (req, res) => {
    const body = parseBody(reorderSchema, req.body);
    res.json({ quiz: await quizService.reorder(req.auth!.sub, req.params.id, body.questionIds) });
  })
);
