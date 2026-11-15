import type { NormNutrition } from '../../../types';
import { envMode, type IntegrationAdapter } from '../types';
import { mockYazio } from '../mock';
import { sidecarSync } from '../live';
import { num, parseCsv } from '../csv';
import { upsertResult } from '../upsert';
import { createHash } from 'node:crypto';

export const yazio: IntegrationAdapter = {
  id: 'yazio',
  label: 'Yazio',
  capabilities: ['Mahlzeiten', 'Kalorien & Makros'],
  risk: 'Keine offizielle API; die Community-Lib ist per Web nicht verifizierbar/ggf. nicht gepflegt – live ist Stub, Fallback ist CSV-Import.',
  mode: () => envMode('yazio'),
  sync: ({ since }) => (envMode('yazio') === 'mock' ? Promise.resolve(mockYazio()) : sidecarSync('yazio', since))
};

/** CSV: date,meal,name,kcal,protein,carbs,fat (date YYYY-MM-DD; meal optional) */
export function importCsv(userId: string, text: string): { items: number; skipped: number } {
  const seen = new Map<string, number>();
  const nutrition: NormNutrition[] = [];
  let skipped = 0;
  for (const r of parseCsv(text)) {
    const kcal = num(r.kcal);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date ?? '') || !r.name || !Number.isFinite(kcal)) { skipped++; continue; }
    const base = `csv-${createHash('sha1').update([r.date, r.meal, r.name].join('|')).digest('hex').slice(0, 16)}`;
    const n = (seen.get(base) ?? 0) + 1; seen.set(base, n);
    nutrition.push({
      externalId: `${base}-${n}`, date: r.date, meal: r.meal || undefined, name: r.name,
      kcal, protein: num(r.protein) || 0, carbs: num(r.carbs) || 0, fat: num(r.fat) || 0
    });
  }
  return { ...upsertResult(userId, 'yazio', { workouts: [], nutrition, body: [] }), skipped };
}
