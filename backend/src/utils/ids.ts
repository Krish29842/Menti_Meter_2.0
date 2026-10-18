import { randomUUID } from 'crypto';

export function newId(prefix: string): string {
  return `${prefix}-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/** Random 6-digit session code formatted like "583-921". */
export function randomSessionCode(): string {
  const digits = Math.floor(100000 + Math.random() * 900000).toString();
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export function normalizeCode(code: string): string {
  return code.replace(/\D/g, '');
}
