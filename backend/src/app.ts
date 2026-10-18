import path from 'path';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import env from './config/env';
import { authenticate, requireHost } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import { authRouter } from './routes/auth.routes';
import { mediaRouter } from './routes/media.routes';
import { quizRouter } from './routes/quiz.routes';
import { sessionRouter } from './routes/session.routes';

export function createApp(): express.Express {
  const app = express();

  app.set('trust proxy', 1);
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.corsOrigins.includes('*') || env.corsOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
          callback(null, true);
        } else {
          callback(null, true);
        }
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  const globalLimiter = rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, slow down' },
  });
  const authLimiter = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many auth attempts, try again shortly' },
  });

  app.use(globalLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'quizwave-backend', time: Date.now() });
  });

  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/quizzes', quizRouter);
  app.use('/api/sessions', sessionRouter);
  app.use('/api/media', mediaRouter);

  // Uploaded media — served with CORP relaxed so <img>/<audio> can load cross-origin.
  app.use(
    '/media',
    express.static(path.resolve(env.mediaDir), {
      dotfiles: 'deny',
      index: false,
      maxAge: '7d',
    })
  );

  // Host media management helpers (list is intentionally minimal).
  app.get('/api/media', authenticate, requireHost, (_req, res) => {
    res.json({ driver: env.mediaDriver, basePath: '/media' });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
