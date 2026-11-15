import { createHash, randomBytes } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';
import { db, schema } from '../db';

export const COOKIE = 'hub_session';
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const RENEW_AFTER_MS = SESSION_MS / 2; // sliding: nur alle ~15 Tage schreiben

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function createSession(userId: string, ip: string | null, ua: string | null) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + SESSION_MS;
  db.insert(schema.sessions)
    .values({ id: hashToken(token), userId, expiresAt, ip, userAgent: ua?.slice(0, 255) ?? null })
    .run();
  return { token, expiresAt };
}

export function validateSession(token: string) {
  const id = hashToken(token);
  const row = db
    .select({ s: schema.sessions, u: { id: schema.users.id, email: schema.users.email } })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(eq(schema.sessions.id, id))
    .get();
  if (!row) return null;
  const now = Date.now();
  if (row.s.expiresAt <= now) {
    db.delete(schema.sessions).where(eq(schema.sessions.id, id)).run(); // lazy löschen
    return null;
  }
  let expiresAt = row.s.expiresAt;
  let renewed = false;
  if (expiresAt - now < SESSION_MS - RENEW_AFTER_MS) {
    expiresAt = now + SESSION_MS;
    renewed = true;
    db.update(schema.sessions).set({ expiresAt }).where(eq(schema.sessions.id, id)).run();
  }
  return { user: row.u, sessionId: id, expiresAt, renewed };
}

export function invalidateSession(sessionId: string) {
  db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run();
}

/** Räumt abgelaufene Sessions auf (gelegentlich aufgerufen). */
export function purgeExpiredSessions() {
  db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, Date.now())).run();
}

export function isSecureOrigin(dev: boolean) {
  const origin = process.env.ORIGIN ?? '';
  return !(dev || origin.startsWith('http://localhost'));
}

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: number, dev: boolean) {
  cookies.set(COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureOrigin(dev),
    expires: new Date(expiresAt)
  });
}

export function clearSessionCookie(cookies: Cookies, dev: boolean) {
  cookies.delete(COOKIE, { path: '/', httpOnly: true, sameSite: 'lax', secure: isSecureOrigin(dev) });
}
