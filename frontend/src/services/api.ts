/**
 * REST client for the QuizWave backend.
 * Dual-mode: when the backend health check succeeds we run in `remote`
 * mode; otherwise every call falls back to the local simulation layer.
 */
import type { Quiz, Session, User } from '../types/quiz';

/**
 * Backend base URL — configured via VITE_API_URL.
 * Local dev: copy .env.example → .env.local (VITE_API_URL=http://localhost:4000)
 * Deploy: set VITE_API_URL in Vercel project environment variables.
 */
const configuredApiUrl = import.meta.env.VITE_API_URL as string | undefined;

if (!configuredApiUrl) {
  throw new Error(
    'VITE_API_URL is not set. Copy frontend/.env.example to frontend/.env.local ' +
      'for local dev, or set VITE_API_URL in your Vercel project settings.'
  );
}

export const API_URL: string = configuredApiUrl.replace(/\/+$/, '');

const HOST_TOKEN_KEY = 'quizwave_host_token_v1';
const STUDENT_TOKEN_KEY = 'quizwave_student_token_v1';

let modePromise: Promise<'remote' | 'local'> | null = null;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getHostToken(): string | null {
  return localStorage.getItem(HOST_TOKEN_KEY);
}

export function setHostToken(token: string | null) {
  if (token) localStorage.setItem(HOST_TOKEN_KEY, token);
  else localStorage.removeItem(HOST_TOKEN_KEY);
}

export function getStudentToken(): string | null {
  return localStorage.getItem(STUDENT_TOKEN_KEY);
}

export function setStudentToken(token: string | null) {
  if (token) localStorage.setItem(STUDENT_TOKEN_KEY, token);
  else localStorage.removeItem(STUDENT_TOKEN_KEY);
}

/** Probes the backend once and caches the result (re-probed on failure after 5s). */
export function detectMode(): Promise<'remote' | 'local'> {
  if (!modePromise) {
    modePromise = (async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(`${API_URL}/api/health`, {
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          console.info(`[quizwave] backend connected → ${API_URL}`);
          return 'remote' as const;
        }
      } catch {
        /* offline */
      }
      console.info('[quizwave] backend unreachable → local BroadcastChannel mode');
      return 'local' as const;
    })();
  }
  return modePromise;
}

/** Forces re-detection (used after login attempts). */
export function resetModeDetection() {
  modePromise = null;
}

export async function isRemote(): Promise<boolean> {
  return (await detectMode()) === 'remote';
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string | null;
    formData?: FormData;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = options.token === undefined ? getHostToken() : options.token;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}/api${path}`, {
    method: options.method || (options.body !== undefined || options.formData ? 'POST' : 'GET'),
    headers,
    body: options.formData ? options.formData : options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* no content */
  }
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

// ------------------------------------------------------------------ auth

export const authApi = {
  demoLogin: () =>
    request<{ token: string; user: User }>('/auth/demo', { method: 'POST' }),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      body: { email, password },
    }),
  register: (email: string, password: string, name?: string) =>
    request<{ token: string; user: User }>('/auth/register', {
      body: { email, password, name },
    }),
  me: (token: string) =>
    request<{ user: User }>('/auth/me', { token }),
};

// ------------------------------------------------------------------ quizzes

/** Backend quiz payload — question fields are optional beyond the prompt. */
export interface QuizPayload {
  title?: string;
  description?: string;
  basePoints?: number;
  questions?: {
    prompt: string;
    imageUrl?: string;
    videoUrl?: string;
    audioUrl?: string;
    timeLimitSec?: number;
    options: {
      text: string;
      imageUrl?: string;
      videoUrl?: string;
      isCorrect: boolean;
    }[];
  }[];
}

export const quizApi = {
  list: () => request<{ quizzes: Quiz[] }>('/quizzes'),
  get: (id: string) => request<{ quiz: Quiz }>(`/quizzes/${id}`),
  create: (payload: QuizPayload) => request<{ quiz: Quiz }>('/quizzes', { body: payload }),
  update: (id: string, payload: QuizPayload) =>
    request<{ quiz: Quiz }>(`/quizzes/${id}`, { body: payload, method: 'PUT' }),
  remove: (id: string) => request<void>(`/quizzes/${id}`, { method: 'DELETE' }),
  duplicate: (id: string) => request<{ quiz: Quiz }>(`/quizzes/${id}/duplicate`, { method: 'POST' }),
};

// ------------------------------------------------------------------ sessions

export const sessionApi = {
  create: (quizId: string) =>
    request<{ session: Session }>('/sessions', { body: { quizId } }),
  list: () => request<{ sessions: Session[] }>('/sessions'),
  state: (id: string) =>
    request<{ session: Session; hostState: any; lobby: any }>(`/sessions/${id}/state`),
  start: (id: string) => request<{ ok: boolean }>(`/sessions/${id}/start`, { method: 'POST' }),
  next: (id: string) => request<{ ok: boolean }>(`/sessions/${id}/next`, { method: 'POST' }),
  close: (id: string) => request<{ ok: boolean }>(`/sessions/${id}/close`, { method: 'POST' }),
  end: (id: string) => request<{ ok: boolean }>(`/sessions/${id}/end`, { method: 'POST' }),
  results: (id: string) => request<{ results: any }>(`/sessions/${id}/results`),
  codePreview: (code: string) =>
    request<{ session: Session; quizTitle: string; connectedStudentsCount: number }>(
      `/sessions/code/${code}`
    ),
  join: (code: string, displayName: string, avatar: string) =>
    request<{ token: string; participant: any; session: Session }>('/sessions/join', {
      body: { code, displayName, avatar },
      token: null,
    }),
  studentState: (id: string) =>
    request<any>(`/sessions/${id}/student`, { token: getStudentToken() }),
  answer: (id: string, questionId: string, optionId: string, token?: string) =>
    request<{ result: any; answeredCount: number }>(`/sessions/${id}/answer`, {
      body: { questionId, optionId },
      token: token ?? getStudentToken(),
    }),
};

// ------------------------------------------------------------------ media

export const mediaApi = {
  /** Uploads to the backend; returns a /media/... URL. */
  upload: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const data = await request<{ url: string }>('/media/upload', { formData });
    return `${API_URL}${data.url}`;
  },
};
