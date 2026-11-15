import type { NormBody, NormNutrition, NormWorkout, SyncResult } from '../../types';
import { berlinDate } from './time';

const DAY = 86_400_000;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** deterministischer PRNG (mulberry32) je Schlüssel */
function rng(key: string) {
  let a = hash(key);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/** Tagesbeginn 00:00 UTC der letzten 7 Tage (heute inkl.) */
function days(now: number): number[] {
  const today = Math.floor(now / DAY) * DAY;
  return Array.from({ length: 7 }, (_, i) => today - (6 - i) * DAY);
}
const dayKey = (d: number) => new Date(d).toISOString().slice(0, 10);

export function mockGarmin(now = Date.now()): SyncResult {
  const workouts: NormWorkout[] = [];
  days(now).forEach((d, i) => {
    const r = rng('garmin' + dayKey(d));
    if (i % 2 === 1 && r() > 0.2) {
      const kind = ['Laufen', 'Radfahren', 'Wandern'][Math.floor(r() * 3)];
      const dur = Math.round(30 + r() * 50) * 60_000;
      const start = d + (17 + Math.floor(r() * 3)) * 3_600_000;
      workouts.push({ externalId: `garmin-${dayKey(d)}-${kind}`, startedAt: start, endedAt: start + dur, title: `${kind} ${round(dur / 60_000 / 6, 1)} km` });
    }
  });
  if (!workouts.length) {
    const d = days(now)[1];
    workouts.push({ externalId: `garmin-${dayKey(d)}-Laufen`, startedAt: d + 18 * 3_600_000, endedAt: d + 19 * 3_600_000, title: 'Laufen 8.0 km' });
  }
  return { workouts, nutrition: [], body: [] };
}

const MEALS: [string, string, number, number, number, number][] = [
  ['breakfast', 'Haferflocken mit Skyr', 520, 38, 62, 12],
  ['lunch', 'Hähnchen mit Reis und Brokkoli', 720, 55, 85, 16],
  ['snack', 'Proteinshake', 180, 30, 8, 3],
  ['dinner', 'Lachs mit Kartoffeln', 680, 42, 55, 30]
];
export function mockYazio(now = Date.now()): SyncResult {
  const nutrition: NormNutrition[] = [];
  for (const d of days(now)) {
    const r = rng('yazio' + dayKey(d));
    for (const [meal, name, kcal, p, c, f] of MEALS) {
      const k = 0.9 + r() * 0.2;
      nutrition.push({
        externalId: `yazio-${dayKey(d)}-${meal}`, date: dayKey(d), meal, name,
        kcal: Math.round(kcal * k), protein: round(p * k), carbs: round(c * k), fat: round(f * k)
      });
    }
  }
  return { workouts: [], nutrition, body: [] };
}

export function mockRenpho(now = Date.now()): SyncResult {
  const body: NormBody[] = days(now).map((d, i) => {
    const r = rng('renpho' + dayKey(d));
    return {
      externalId: `renpho-${dayKey(d)}`, measuredAt: d + 6 * 3_600_000 + 30 * 60_000,
      weightKg: round(82.4 - i * 0.08 + (r() - 0.5) * 0.6), bodyFatPct: round(18.6 - i * 0.03 + (r() - 0.5) * 0.4)
    };
  });
  return { workouts: [], nutrition: [], body };
}

export function mockApple(now = Date.now()): SyncResult {
  const ds = days(now);
  const body: NormBody[] = ds.map((d, i) => {
    const r = rng('apple' + dayKey(d));
    return { externalId: `apple-weight-${dayKey(d)}`, measuredAt: d + 7 * 3_600_000, weightKg: round(82.5 - i * 0.07 + (r() - 0.5) * 0.5) };
  });
  const workouts: NormWorkout[] = [0, 2, 4, 6].map((i) => {
    const d = ds[i];
    const start = d + 17 * 3_600_000;
    return {
      externalId: `apple-workout-${dayKey(d)}`, startedAt: start, endedAt: start + 55 * 60_000,
      title: ['Traditional Strength Training', 'Walking', 'Functional Strength Training', 'Cycling'][i / 2]
    };
  });
  return { workouts, nutrition: [], body };
}
