import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { COOKIE, validateSession, setSessionCookie, clearSessionCookie, purgeExpiredSessions } from '$lib/server/auth/session';

let lastPurge = 0;

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = null;
  event.locals.sessionId = null;

  const token = event.cookies.get(COOKIE);
  if (token) {
    const res = validateSession(token);
    if (res) {
      event.locals.user = res.user;
      event.locals.sessionId = res.sessionId;
      if (res.renewed) setSessionCookie(event.cookies, token, res.expiresAt, dev);
    } else {
      clearSessionCookie(event.cookies, dev);
    }
  }
  if (Date.now() - lastPurge > 60 * 60 * 1000) {
    lastPurge = Date.now();
    purgeExpiredSessions();
  }

  const response = await resolve(event);
  const h = response.headers;
  // script-src 'unsafe-inline': SvelteKit injiziert ein Inline-Boot-Skript (kein kit.csp konfiguriert).
  h.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'"
  );
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'same-origin');
  h.set('Permissions-Policy', 'microphone=(self)');
  return response;
};
