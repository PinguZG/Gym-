import { and, asc, desc, eq, gte } from 'drizzle-orm';
import { db, schema } from '../db';
import type { BodyPoint } from '../../types';
import { addDays, noonMs, today } from './dates';

const { bodyMetrics } = schema;

export function addMetric(
  userId: string,
  m: { date: string; weightKg?: number | null; bodyFatPct?: number | null }
): { id: string } {
  const id = crypto.randomUUID();
  db.insert(bodyMetrics)
    .values({
      id,
      userId,
      date: m.date,
      measuredAt: m.date === today() ? Date.now() : noonMs(m.date),
      weightKg: m.weightKg ?? null,
      bodyFatPct: m.bodyFatPct ?? null,
      source: 'manual'
    })
    .run();
  return { id };
}

export function bodySeries(userId: string, days = 90): BodyPoint[] {
  const from = addDays(today(), -days);
  const rows = db
    .select()
    .from(bodyMetrics)
    .where(and(eq(bodyMetrics.userId, userId), gte(bodyMetrics.date, from)))
    .orderBy(asc(bodyMetrics.date), asc(bodyMetrics.measuredAt))
    .all();
  const byDate = new Map<string, BodyPoint>();
  for (const r of rows) {
    const p = byDate.get(r.date) ?? { date: r.date, weightKg: null, bodyFatPct: null };
    if (r.weightKg != null) p.weightKg = r.weightKg;
    if (r.bodyFatPct != null) p.bodyFatPct = r.bodyFatPct;
    byDate.set(r.date, p);
  }
  return [...byDate.values()];
}

export function latestBody(userId: string): { weightKg: number | null; bodyFatPct: number | null; date: string } | null {
  const rows = db
    .select()
    .from(bodyMetrics)
    .where(eq(bodyMetrics.userId, userId))
    .orderBy(desc(bodyMetrics.date), desc(bodyMetrics.measuredAt))
    .limit(200)
    .all();
  if (!rows.length) return null;
  return {
    date: rows[0].date,
    weightKg: rows.find((r) => r.weightKg != null)?.weightKg ?? null,
    bodyFatPct: rows.find((r) => r.bodyFatPct != null)?.bodyFatPct ?? null
  };
}
