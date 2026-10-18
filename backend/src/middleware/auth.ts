import type { NextFunction, Request, Response } from 'express';
import { verifyToken, type TokenPayload } from '../services/auth.service';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: TokenPayload;
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(Object.assign(new Error('Authentication required'), { status: 401 }));
  }
  try {
    req.auth = verifyToken(header.slice(7));
    next();
  } catch {
    next(Object.assign(new Error('Invalid or expired token'), { status: 401 }));
  }
}

/** FR-A3: role enforced at API level — only hosts reach /host scoped routes. */
export function requireHost(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) {
    return next(Object.assign(new Error('Authentication required'), { status: 401 }));
  }
  if (req.auth.role !== 'host') {
    return next(Object.assign(new Error('Host role required'), { status: 403 }));
  }
  next();
}

export function requireStudent(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth?.participantId || req.auth.role !== 'student') {
    return next(Object.assign(new Error('Student role required'), { status: 403 }));
  }
  next();
}
