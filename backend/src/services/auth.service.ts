import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import { getStorage } from '../storage';
import type { PublicUser, Role, User } from '../types/domain';
import { newId } from '../utils/ids';

export interface TokenPayload {
  sub: string;
  role: Role;
  sessionId?: string;
  participantId?: string;
}

function toPublic(user: User): PublicUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtSecret) as TokenPayload;
}

class AuthService {
  async register(email: string, password: string, name: string) {
    const storage = getStorage();
    const existing = await storage.users.findByEmail(email);
    if (existing) {
      throw Object.assign(new Error('An account with this email already exists'), {
        status: 409,
      });
    }
    const user: User = {
      id: newId('host'),
      email: email.trim().toLowerCase(),
      name: name.trim() || email.split('@')[0],
      passwordHash: await bcrypt.hash(password, 10),
      role: 'host',
      createdAt: Date.now(),
    };
    await storage.users.create(user);
    return { token: signToken({ sub: user.id, role: 'host' }), user: toPublic(user) };
  }

  async login(email: string, password: string) {
    const storage = getStorage();
    const user = await storage.users.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw Object.assign(new Error('Invalid email or password'), { status: 401 });
    }
    return { token: signToken({ sub: user.id, role: 'host' }), user: toPublic(user) };
  }

  /** FR-A1: demo quick-login support (1-click guest host). */
  async demoLogin() {
    const storage = getStorage();
    const email = 'host@quizwave.live';
    let user = await storage.users.findByEmail(email);
    if (!user) {
      user = await storage.users.create({
        id: newId('host'),
        email,
        name: 'Professor Alex',
        passwordHash: await bcrypt.hash('demo-demo', 10),
        role: 'host',
        createdAt: Date.now(),
      });
    }
    return { token: signToken({ sub: user.id, role: 'host' }), user: toPublic(user) };
  }

  async getHost(userId: string): Promise<PublicUser | null> {
    const user = await getStorage().users.findById(userId);
    return user ? toPublic(user) : null;
  }
}

export const authService = new AuthService();
