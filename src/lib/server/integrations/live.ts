import { z } from 'zod';
import type { ProviderId, SyncResult } from '../../types';

const set = z.object({
  exerciseName: z.string(), muscle: z.string().optional(), weightKg: z.number(), reps: z.number().int(), rpe: z.number().nullable().optional()
});
const resultSchema = z.object({
  workouts: z.array(z.object({
    externalId: z.string(), startedAt: z.number(), endedAt: z.number().optional(), title: z.string().optional(), sets: z.array(set).optional()
  })).default([]),
  nutrition: z.array(z.object({
    externalId: z.string(), date: z.string(), meal: z.string().optional(), name: z.string(),
    kcal: z.number(), protein: z.number(), carbs: z.number(), fat: z.number()
  })).default([]),
  body: z.array(z.object({
    externalId: z.string(), measuredAt: z.number(), weightKg: z.number().optional(), bodyFatPct: z.number().optional()
  })).default([])
});

/** HTTP-Client zum Python-Sidecar. Zugangsdaten liegen nur im Sidecar. */
export async function sidecarSync(id: Exclude<ProviderId, 'apple'>, since: number): Promise<SyncResult> {
  const base = process.env.SYNC_URL;
  const secret = process.env.SYNC_SHARED_SECRET;
  if (!base || !secret) throw new Error('SYNC_URL / SYNC_SHARED_SECRET nicht gesetzt');
  const res = await fetch(`${base.replace(/\/$/, '')}/${id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Sync-Secret': secret },
    body: JSON.stringify({ since }),
    signal: AbortSignal.timeout(30_000)
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`Sidecar ${id}: HTTP ${res.status} ${detail}`);
  }
  return resultSchema.parse(await res.json()) as SyncResult;
}
