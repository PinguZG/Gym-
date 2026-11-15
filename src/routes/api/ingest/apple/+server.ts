import { json, type RequestHandler } from '@sveltejs/kit';
import { createHash, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';
import { db, schema } from '$lib/server/db';
import { apple } from '$lib/server/integrations/adapters/apple';

const MAX_BYTES = 2 * 1024 * 1024;
const sha = (s: string) => createHash('sha256').update(s).digest();

export const POST: RequestHandler = async ({ request }) => {
  const token = process.env.APPLE_INGEST_TOKEN;
  const email = process.env.APPLE_INGEST_USER_EMAIL;
  if (!token || token.length < 32 || token === 'change-me' || !email) return json({ error: 'ingest not configured' }, { status: 503 });
  if (apple.mode() === 'off') return json({ error: 'integration disabled' }, { status: 503 });

  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '');
  if (!m || !timingSafeEqual(sha(m[1]), sha(token))) return json({ error: 'unauthorized' }, { status: 401 });

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES) return json({ error: 'payload too large' }, { status: 413 });
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BYTES) return json({ error: 'payload too large' }, { status: 413 });

  let payload: unknown;
  try { payload = JSON.parse(text); } catch { return json({ error: 'invalid json' }, { status: 400 }); }

  const user = db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email.toLowerCase())).get();
  if (!user) return json({ error: 'user not found' }, { status: 404 });

  try {
    const { items } = await apple.ingest!(payload, user.id);
    return json({ ok: true, items });
  } catch (e) {
    if (e instanceof ZodError) return json({ error: 'invalid payload', issues: e.issues.slice(0, 5) }, { status: 422 });
    throw e;
  }
};
