import type { NormBody } from '../../../types';
import { envMode, type IntegrationAdapter } from '../types';
import { mockRenpho } from '../mock';
import { sidecarSync } from '../live';
import { num, parseCsv } from '../csv';
import { upsertResult } from '../upsert';

export const renpho: IntegrationAdapter = {
  id: 'renpho',
  label: 'RENPHO',
  capabilities: ['Gewicht', 'Körperfett'],
  risk: 'Inoffizielle Lib (renpho-api, Reverse-Engineering der Renpho-Health-App-API): jederzeit durch Backend-Änderungen brechbar; Fallback CSV-Export / Apple Health.',
  mode: () => envMode('renpho'),
  sync: ({ since }) => (envMode('renpho') === 'mock' ? Promise.resolve(mockRenpho()) : sidecarSync('renpho', since))
};

/** CSV: date,weight_kg,body_fat_pct (date YYYY-MM-DD oder ISO-Zeit; bodyfat optional) */
export function importCsv(userId: string, text: string): { items: number; skipped: number } {
  const body: NormBody[] = [];
  let skipped = 0;
  for (const r of parseCsv(text)) {
    const date = r.date ?? '';
    const ts = /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(`${date}T07:00:00Z`) : Date.parse(date);
    const w = num(r.weight_kg), f = num(r.body_fat_pct);
    if (!Number.isFinite(ts) || (!Number.isFinite(w) && !Number.isFinite(f))) { skipped++; continue; }
    body.push({
      externalId: `csv-${new Date(ts).toISOString()}`, measuredAt: ts,
      weightKg: Number.isFinite(w) ? w : undefined, bodyFatPct: Number.isFinite(f) ? f : undefined
    });
  }
  return { ...upsertResult(userId, 'renpho', { workouts: [], nutrition: [], body }), skipped };
}
