import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { dev } from '$app/environment';
import { db, schema } from '$lib/server/db';
import { verifyPassword, dummyVerify } from '$lib/server/auth/password';
import { createSession, setSessionCookie } from '$lib/server/auth/session';
import { loginKey, isLimited, recordFailure, clearFailures } from '$lib/server/auth/ratelimit';
import type { Actions, PageServerLoad } from './$types';

const Schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256)
});
const GENERIC = 'E-Mail oder Passwort falsch';

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) redirect(303, '/dashboard');
  return { registration: process.env.ALLOW_REGISTRATION === 'true' };
};

export const actions: Actions = {
  default: async ({ request, cookies, getClientAddress }) => {
    const form = await request.formData();
    const parsed = Schema.safeParse({ email: form.get('email'), password: form.get('password') });
    const rawEmail = String(form.get('email') ?? '').slice(0, 254);
    if (!parsed.success) return fail(400, { error: GENERIC, email: rawEmail });
    const { email, password } = parsed.data;

    let ip = 'unknown';
    try { ip = getClientAddress(); } catch { /* ignore */ }
    const key = loginKey(ip, email);
    if (isLimited(key)) {
      return fail(429, { error: 'Zu viele Versuche. Bitte in 15 Minuten erneut versuchen.', email });
    }

    const user = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
    let ok = false;
    if (user) ok = await verifyPassword(user.passwordHash, password);
    else await dummyVerify(password);

    if (!user || !ok) {
      recordFailure(key);
      return fail(400, { error: GENERIC, email });
    }

    clearFailures(key);
    const { token, expiresAt } = createSession(user.id, ip, request.headers.get('user-agent'));
    setSessionCookie(cookies, token, expiresAt, dev);
    redirect(303, '/dashboard');
  }
};
