import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { dev } from '$app/environment';
import { db, schema } from '$lib/server/db';
import { hashPassword } from '$lib/server/auth/password';
import { createSession, setSessionCookie } from '$lib/server/auth/session';
import type { Actions, PageServerLoad } from './$types';

const enabled = () => process.env.ALLOW_REGISTRATION === 'true';

const Schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10, 'Passwort mindestens 10 Zeichen').max(256)
});

export const load: PageServerLoad = () => {
  if (!enabled()) error(404, 'Not found');
  return {};
};

export const actions: Actions = {
  default: async ({ request, cookies, getClientAddress }) => {
    if (!enabled()) error(404, 'Not found');
    const form = await request.formData();
    const email = String(form.get('email') ?? '').slice(0, 254);
    const parsed = Schema.safeParse({ email, password: form.get('password') });
    if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message, email });
    const exists = db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, parsed.data.email)).get();
    if (exists) return fail(400, { error: 'Registrierung nicht möglich', email });
    const id = crypto.randomUUID();
    db.insert(schema.users).values({ id, email: parsed.data.email, passwordHash: await hashPassword(parsed.data.password) }).run();
    let ip = 'unknown';
    try { ip = getClientAddress(); } catch { /* ignore */ }
    const { token, expiresAt } = createSession(id, ip, request.headers.get('user-agent'));
    setSessionCookie(cookies, token, expiresAt, dev);
    redirect(303, '/dashboard');
  }
};
