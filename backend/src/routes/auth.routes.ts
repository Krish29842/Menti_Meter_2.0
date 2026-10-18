import { Router } from 'express';
import { handler, parseBody } from '../middleware/error';
import { authenticate } from '../middleware/auth';
import { authService } from '../services/auth.service';
import { loginSchema, registerSchema } from '../utils/validation';

export const authRouter = Router();

authRouter.post(
  '/register',
  handler(async (req, res) => {
    const body = parseBody(registerSchema, req.body);
    res.status(201).json(await authService.register(body.email, body.password, body.name ?? ''));
  })
);

authRouter.post(
  '/login',
  handler(async (req, res) => {
    const body = parseBody(loginSchema, req.body);
    res.json(await authService.login(body.email, body.password));
  })
);

/** FR-A1: demo quick-login support. */
authRouter.post(
  '/demo',
  handler(async (_req, res) => {
    res.json(await authService.demoLogin());
  })
);

authRouter.get(
  '/me',
  authenticate,
  handler(async (req, res) => {
    const user = await authService.getHost(req.auth!.sub);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user });
  })
);
