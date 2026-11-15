import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '../db';
import type { IntegrationMode, ProviderId } from '../../types';
import type { IntegrationAdapter } from './types';
import { apple } from './adapters/apple';
import { garmin } from './adapters/garmin';
import { yazio } from './adapters/yazio';
import { renpho } from './adapters/renpho';
import { upsertResult } from './upsert';

const HOUR = 3_600_000;
const THROTTLE_MS = 6 * HOUR;
const MAX_BACKOFF_MS = 24 * HOUR;

export const adapters: Record<ProviderId, IntegrationAdapter> = { apple, garmin, yazio, renpho };
export const getAdapter = (id: string): IntegrationAdapter | undefined => (adapters as Record<string, IntegrationAdapter>)[id];

const { integrationRuns } = schema;

export function integrationStatus(userId?: string): {
  id: ProviderId; label: string; mode: IntegrationMode;
  lastRun: { at: number; status: string; items: number } | null; risk: string;
}[] {
  return Object.values(adapters).map((a) => {
    const where = userId ? and(eq(integrationRuns.provider, a.id), eq(integrationRuns.userId, userId)) : eq(integrationRuns.provider, a.id);
    const r = db.select().from(integrationRuns).where(where).orderBy(desc(integrationRuns.startedAt)).limit(1).get();
    return { id: a.id, label: a.label, mode: a.mode(), lastRun: r ? { at: r.startedAt, status: r.status, items: r.items } : null, risk: a.risk };
  });
}

/** Wartezeit (ms) bis zum nächsten erlaubten Live-Sync; 0 = erlaubt. */
function liveWait(userId: string, id: ProviderId, now: number): number {
  const runs = db.select().from(integrationRuns)
    .where(and(eq(integrationRuns.userId, userId), eq(integrationRuns.provider, id), eq(integrationRuns.mode, 'live')))
    .orderBy(desc(integrationRuns.startedAt)).limit(12).all();
  if (!runs.length) return 0;
  const last = runs[0];
  if (last.status === 'ok') return Math.max(0, last.startedAt + THROTTLE_MS - now);
  let fails = 0;
  for (const r of runs) { if (r.status === 'error') fails++; else break; }
  const backoff = Math.min(HOUR * 2 ** (fails - 1), MAX_BACKOFF_MS); // 1h, 2h, 4h, ...
  return Math.max(0, last.startedAt + backoff - now);
}

export async function runSync(userId: string, id: ProviderId): Promise<{ items: number }> {
  const a = getAdapter(id);
  if (!a) throw new Error(`Unbekannter Provider: ${id}`);
  const mode = a.mode();
  if (mode === 'off') throw new Error(`Integration ${a.label} ist deaktiviert (INTEGRATION_${id.toUpperCase()}=off)`);
  const now = Date.now();
  if (mode === 'live') {
    const wait = liveWait(userId, id, now);
    if (wait > 0) throw new Error(`${a.label}: Sync gedrosselt, nächster Versuch in ${Math.ceil(wait / 60_000)} min`);
  }
  const lastOk = db.select().from(integrationRuns)
    .where(and(eq(integrationRuns.userId, userId), eq(integrationRuns.provider, id), eq(integrationRuns.status, 'ok')))
    .orderBy(desc(integrationRuns.startedAt)).limit(1).get();
  const since = lastOk?.startedAt ?? now - 7 * 24 * HOUR;
  try {
    const result = await a.sync({ userId, since });
    const { items } = upsertResult(userId, id, result);
    db.insert(integrationRuns).values({ userId, provider: id, mode, startedAt: now, status: 'ok', items }).run();
    return { items };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    db.insert(integrationRuns).values({ userId, provider: id, mode, startedAt: now, status: 'error', items: 0, error: msg.slice(0, 500) }).run();
    throw e;
  }
}
