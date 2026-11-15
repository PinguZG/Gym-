import { z } from 'zod';
import type { NormBody, NormWorkout, SyncResult } from '../../../types';
import { emptyResult, envMode, type IntegrationAdapter } from '../types';
import { mockApple } from '../mock';
import { upsertResult } from '../upsert';

/** "2026-11-14 08:15:00 +0100" | ISO -> ms UTC (NaN bei Fehler) */
export function parseHaeDate(s: string): number {
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)\s*(Z|[+-]\d{2}:?\d{2})?$/);
  if (!m) return Date.parse(s);
  const tz = m[3] ? (m[3] === 'Z' ? 'Z' : m[3].replace(/^([+-]\d{2})(\d{2})$/, '$1:$2')) : 'Z';
  const t = m[2].length === 5 ? m[2] + ':00' : m[2];
  return Date.parse(`${m[1]}T${t}${tz}`);
}

const point = z.object({ date: z.string(), qty: z.coerce.number().optional() }).passthrough();
const metric = z.object({ name: z.string(), units: z.string().optional(), data: z.array(point).default([]) }).passthrough();
const qtyUnit = z.object({ qty: z.coerce.number().optional(), units: z.string().optional() }).passthrough();
const workout = z.object({
  id: z.string().optional(), name: z.string().optional(), start: z.string(), end: z.string().optional(),
  duration: z.coerce.number().optional(), activeEnergyBurned: qtyUnit.optional()
}).passthrough();

/** Health Auto Export (REST-API-Automation, JSON v2): { data: { metrics: [...], workouts: [...] } } */
export const appleSchema = z.object({
  data: z.object({ metrics: z.array(metric).default([]), workouts: z.array(workout).default([]) }).passthrough()
}).passthrough();

const toKg = (q: number, unit?: string): number => {
  const u = (unit ?? 'kg').toLowerCase();
  if (u === 'lb' || u === 'lbs') return q * 0.45359237;
  if (u === 'st') return q * 6.35029318;
  if (u === 'g') return q / 1000;
  return q;
};

export function normalizeApple(payload: unknown): SyncResult {
  const parsed = appleSchema.parse(payload);
  const bodyMap = new Map<number, NormBody>();
  const entry = (ts: number) => {
    let b = bodyMap.get(ts);
    if (!b) { b = { externalId: `apple-body-${ts}`, measuredAt: ts }; bodyMap.set(ts, b); }
    return b;
  };
  for (const m of parsed.data.metrics) {
    if (m.name !== 'weight_body_mass' && m.name !== 'body_fat_percentage') continue; // unbekannte ignorieren
    for (const p of m.data) {
      const ts = parseHaeDate(p.date);
      if (!Number.isFinite(ts) || p.qty == null || !Number.isFinite(p.qty)) continue;
      if (m.name === 'weight_body_mass') entry(ts).weightKg = Math.round(toKg(p.qty, m.units) * 100) / 100;
      else entry(ts).bodyFatPct = Math.round((p.qty <= 1 ? p.qty * 100 : p.qty) * 10) / 10; // Anteil oder Prozent
    }
  }
  const workouts: NormWorkout[] = [];
  for (const w of parsed.data.workouts) {
    const start = parseHaeDate(w.start);
    if (!Number.isFinite(start)) continue;
    const end = w.end ? parseHaeDate(w.end) : NaN;
    workouts.push({
      externalId: w.id ?? `apple-workout-${w.name ?? 'w'}-${start}`, startedAt: start,
      endedAt: Number.isFinite(end) ? end : w.duration ? start + w.duration * 1000 : undefined, title: w.name
    });
  }
  return { workouts, nutrition: [], body: [...bodyMap.values()] };
}

export const apple: IntegrationAdapter = {
  id: 'apple',
  label: 'Apple Health',
  capabilities: ['Gewicht', 'Körperfett', 'Workouts'],
  risk: 'Push über die App „Health Auto Export" (kostenpflichtig, Drittanbieter); Format kann sich mit App-Updates ändern. Kein Pull möglich.',
  mode: () => envMode('apple'),
  async sync() {
    // Push-basiert: im Mock Beispieldaten, live kommen Daten über /api/ingest/apple.
    return this.mode() === 'mock' ? mockApple() : emptyResult();
  },
  async ingest(payload, userId) {
    return upsertResult(userId, 'apple', normalizeApple(payload));
  }
};
