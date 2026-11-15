import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import {
  MUSCLE_GROUPS, epley1rm,
  type MuscleGroup, type PR, type ProgressionPoint, type SuggestedSet, type WeeklyMuscleSets
} from '../../types';
import { addDays, dateOf, msRange, today, weekStart } from './dates';

const { exercises, workouts, sets, personalRecords } = schema;

const de = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
const r1 = (n: number) => Math.round(n * 10) / 10;

export function listExercises(userId: string): { id: string; name: string; primaryMuscle: string }[] {
  return db
    .select({ id: exercises.id, name: exercises.name, primaryMuscle: exercises.primaryMuscle })
    .from(exercises)
    .where(eq(exercises.userId, userId))
    .orderBy(asc(exercises.name))
    .all();
}

export function createExercise(
  userId: string,
  e: { name: string; primaryMuscle: string; secondaryMuscles?: string[] }
): { id: string } {
  const name = e.name.trim();
  const existing = db.select({ id: exercises.id }).from(exercises).where(and(eq(exercises.userId, userId), eq(exercises.name, name))).get();
  if (existing) return existing;
  const id = crypto.randomUUID();
  db.insert(exercises).values({ id, userId, name, primaryMuscle: e.primaryMuscle, secondaryMuscles: e.secondaryMuscles ?? [] }).run();
  return { id };
}

export function startWorkout(userId: string, w: { title?: string | null } = {}): { id: string } {
  const id = crypto.randomUUID();
  db.insert(workouts).values({ id, userId, startedAt: Date.now(), title: w.title ?? null }).run();
  return { id };
}

export function finishWorkout(userId: string, workoutId: string): void {
  db.update(workouts).set({ endedAt: Date.now() }).where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId))).run();
}

export function getWorkout(userId: string, id: string) {
  const w = db.select().from(workouts).where(and(eq(workouts.id, id), eq(workouts.userId, userId))).get();
  if (!w) return null;
  const rows = db
    .select({
      id: sets.id, idx: sets.idx, weightKg: sets.weightKg, reps: sets.reps, rpe: sets.rpe, isWarmup: sets.isWarmup,
      exerciseId: sets.exerciseId, name: exercises.name
    })
    .from(sets)
    .innerJoin(exercises, eq(exercises.id, sets.exerciseId))
    .where(and(eq(sets.workoutId, id), eq(sets.userId, userId)))
    .orderBy(asc(sets.idx), asc(sets.performedAt))
    .all();
  const groups = new Map<string, { exerciseId: string; name: string; sets: { id: string; idx: number; weightKg: number; reps: number; rpe: number | null; isWarmup: boolean }[] }>();
  for (const r of rows) {
    const g = groups.get(r.exerciseId) ?? { exerciseId: r.exerciseId, name: r.name, sets: [] };
    g.sets.push({ id: r.id, idx: r.idx, weightKg: r.weightKg, reps: r.reps, rpe: r.rpe, isWarmup: r.isWarmup });
    groups.set(r.exerciseId, g);
  }
  return { id: w.id, title: w.title, startedAt: w.startedAt, endedAt: w.endedAt, note: w.note, exercises: [...groups.values()] };
}

export function listWorkouts(userId: string, limit = 20) {
  return db
    .select({
      id: workouts.id, title: workouts.title, startedAt: workouts.startedAt, endedAt: workouts.endedAt,
      setCount: sql<number>`coalesce(sum(case when ${sets.isWarmup} = 0 then 1 else 0 end), 0)`,
      volume: sql<number>`coalesce(sum(case when ${sets.isWarmup} = 0 then ${sets.weightKg} * ${sets.reps} else 0 end), 0)`
    })
    .from(workouts)
    .leftJoin(sets, eq(sets.workoutId, workouts.id))
    .where(eq(workouts.userId, userId))
    .groupBy(workouts.id)
    .orderBy(desc(workouts.startedAt))
    .limit(limit)
    .all()
    .map((r) => ({ ...r, setCount: Number(r.setCount), volume: Math.round(Number(r.volume)) }));
}

// ---------- PRs ----------

function upsertPR(userId: string, exerciseId: string, kind: PR['kind'], value: number, setId: string | null, at: number) {
  db.insert(personalRecords)
    .values({ userId, exerciseId, kind, value, setId, achievedAt: at })
    .onConflictDoUpdate({ target: [personalRecords.userId, personalRecords.exerciseId, personalRecords.kind], set: { value, setId, achievedAt: at } })
    .run();
}

/** Berechnet alle PRs einer Übung aus den Arbeitssätzen neu (Seed, nach Löschen). */
export function recomputePRs(userId: string, exerciseId: string): void {
  const rows = db.select().from(sets).where(and(eq(sets.userId, userId), eq(sets.exerciseId, exerciseId), eq(sets.isWarmup, false))).all();
  db.delete(personalRecords).where(and(eq(personalRecords.userId, userId), eq(personalRecords.exerciseId, exerciseId))).run();
  const best: Partial<Record<PR['kind'], { v: number; s: typeof rows[number] }>> = {};
  for (const s of rows) {
    const vals: Record<PR['kind'], number> = { max_weight: s.weightKg, est_1rm: r1(epley1rm(s.weightKg, s.reps)), max_volume: s.weightKg * s.reps };
    for (const k of Object.keys(vals) as PR['kind'][]) {
      const b = best[k];
      if (!b || vals[k] > b.v || (vals[k] === b.v && s.performedAt < b.s.performedAt)) best[k] = { v: vals[k], s };
    }
  }
  for (const k of Object.keys(best) as PR['kind'][]) {
    const b = best[k]!;
    upsertPR(userId, exerciseId, k, b.v, b.s.id, b.s.performedAt);
  }
}

export function addSet(
  userId: string,
  workoutId: string,
  s: { exerciseId: string; weightKg: number; reps: number; rpe?: number | null; isWarmup?: boolean }
): { id: string; newPRs: PR[] } {
  const w = db.select({ id: workouts.id }).from(workouts).where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId))).get();
  if (!w) throw new Error('Training nicht gefunden');
  const ex = db.select().from(exercises).where(and(eq(exercises.id, s.exerciseId), eq(exercises.userId, userId))).get();
  if (!ex) throw new Error('Übung nicht gefunden');

  const maxIdx = db.select({ m: sql<number | null>`max(${sets.idx})` }).from(sets).where(eq(sets.workoutId, workoutId)).get()?.m;
  const id = crypto.randomUUID();
  const now = Date.now();
  const isWarmup = s.isWarmup ?? false;
  db.insert(sets)
    .values({ id, userId, workoutId, exerciseId: s.exerciseId, idx: (maxIdx ?? -1) + 1, weightKg: s.weightKg, reps: s.reps, rpe: s.rpe ?? null, isWarmup, performedAt: now })
    .run();

  const newPRs: PR[] = [];
  if (!isWarmup && s.reps > 0) {
    const existing = db.select().from(personalRecords).where(and(eq(personalRecords.userId, userId), eq(personalRecords.exerciseId, s.exerciseId))).all();
    const hadPrior = existing.length > 0;
    const vals: Record<PR['kind'], number> = { max_weight: s.weightKg, est_1rm: r1(epley1rm(s.weightKg, s.reps)), max_volume: s.weightKg * s.reps };
    for (const kind of Object.keys(vals) as PR['kind'][]) {
      const cur = existing.find((p) => p.kind === kind);
      if (!cur || vals[kind] > cur.value) {
        upsertPR(userId, s.exerciseId, kind, vals[kind], id, now);
        if (hadPrior && cur) newPRs.push({ exerciseId: s.exerciseId, exerciseName: ex.name, kind, value: vals[kind], achievedAt: now });
      }
    }
  }
  return { id, newPRs };
}

export function deleteSet(userId: string, setId: string): void {
  const s = db.select({ exerciseId: sets.exerciseId }).from(sets).where(and(eq(sets.id, setId), eq(sets.userId, userId))).get();
  if (!s) return;
  db.delete(sets).where(and(eq(sets.id, setId), eq(sets.userId, userId))).run();
  recomputePRs(userId, s.exerciseId);
}

export function prs(userId: string, limit = 10): PR[] {
  const rows = db
    .select({ exerciseId: personalRecords.exerciseId, exerciseName: exercises.name, kind: personalRecords.kind, value: personalRecords.value, achievedAt: personalRecords.achievedAt })
    .from(personalRecords)
    .innerJoin(exercises, eq(exercises.id, personalRecords.exerciseId))
    .where(eq(personalRecords.userId, userId))
    .orderBy(desc(personalRecords.achievedAt))
    .all() as PR[];
  const rank = (k: string) => (k === 'est_1rm' ? 0 : k === 'max_weight' ? 1 : 2);
  // pro Übung bevorzugt est_1rm, sonst die nächstbeste Art
  const best = new Map<string, PR>();
  for (const r of rows) {
    const c = best.get(r.exerciseId);
    if (!c || rank(r.kind) < rank(c.kind)) best.set(r.exerciseId, r);
  }
  return [...best.values()].sort((a, b) => b.achievedAt - a.achievedAt).slice(0, limit);
}

// ---------- Vorschlag / Progression ----------

export function suggestSet(userId: string, exerciseId: string): SuggestedSet {
  const last = db
    .select({ workoutId: sets.workoutId })
    .from(sets)
    .where(and(eq(sets.userId, userId), eq(sets.exerciseId, exerciseId), eq(sets.isWarmup, false)))
    .orderBy(desc(sets.performedAt))
    .limit(1)
    .get();
  if (!last) return { weightKg: 20, reps: 10, rpe: null, hint: 'Noch keine Daten – starte leicht', basedOn: null };

  const rows = db
    .select()
    .from(sets)
    .where(and(eq(sets.userId, userId), eq(sets.exerciseId, exerciseId), eq(sets.workoutId, last.workoutId), eq(sets.isWarmup, false)))
    .orderBy(asc(sets.idx))
    .all();
  const top = Math.max(...rows.map((r) => r.weightKg));
  const topSets = rows.filter((r) => r.weightKg === top);
  const targetReps = rows[0].reps; // geplante Wiederholungen = erster Arbeitssatz
  const rpes = topSets.map((r) => r.rpe).filter((x): x is number => x != null);
  const allReached = topSets.every((r) => r.reps >= targetReps);
  const easy = rpes.length === topSets.length && rpes.every((x) => x <= 8);
  const progress = allReached || easy;
  const date = dateOf(rows[rows.length - 1].performedAt);
  const basedOn = `${de(top)} kg × ${topSets[topSets.length - 1].reps} am ${date.slice(8, 10)}.${date.slice(5, 7)}.`;
  if (progress) {
    return { weightKg: top + 2.5, reps: targetReps, rpe: null, hint: 'wie letztes Mal – heute sind +2,5 kg drin', basedOn };
  }
  return { weightKg: top, reps: targetReps, rpe: null, hint: `gleiche Last (${de(top)} kg) – erst alle Sätze sauber schaffen`, basedOn };
}

export function progression(userId: string, exerciseId: string, days = 180): ProgressionPoint[] {
  const from = addDays(today(), -days);
  const rows = db
    .select()
    .from(sets)
    .where(and(eq(sets.userId, userId), eq(sets.exerciseId, exerciseId), eq(sets.isWarmup, false), gte(sets.performedAt, msRange(from, from)[0])))
    .orderBy(asc(sets.performedAt))
    .all();
  const byDate = new Map<string, ProgressionPoint>();
  for (const r of rows) {
    const date = dateOf(r.performedAt);
    if (date < from) continue;
    const p = byDate.get(date) ?? { date, topWeightKg: 0, est1rm: 0, volume: 0 };
    p.topWeightKg = Math.max(p.topWeightKg, r.weightKg);
    p.est1rm = Math.max(p.est1rm, r1(epley1rm(r.weightKg, r.reps)));
    p.volume += r.weightKg * r.reps;
    byDate.set(date, p);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).map((p) => ({ ...p, volume: Math.round(p.volume) }));
}

export function weeklySetsByMuscle(userId: string, weeks = 1): WeeklyMuscleSets[] {
  const thisWeek = weekStart(today());
  const first = addDays(thisWeek, -7 * (weeks - 1));
  const empty = (): Record<MuscleGroup, number> => Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, 0])) as Record<MuscleGroup, number>;
  const out = new Map<string, Record<MuscleGroup, number>>();
  for (let i = 0; i < weeks; i++) out.set(addDays(first, 7 * i), empty());
  const rows = db
    .select({ performedAt: sets.performedAt, muscle: exercises.primaryMuscle })
    .from(sets)
    .innerJoin(exercises, eq(exercises.id, sets.exerciseId))
    .where(and(eq(sets.userId, userId), eq(sets.isWarmup, false), gte(sets.performedAt, msRange(first, first)[0])))
    .all();
  for (const r of rows) {
    const bucket = out.get(weekStart(dateOf(r.performedAt)));
    if (bucket && r.muscle in bucket) bucket[r.muscle as MuscleGroup]++;
  }
  return [...out.entries()].map(([ws, s]) => ({ weekStart: ws, sets: s }));
}

// ---------- Sprach-Eingabe ----------

const NUM_WORDS: Record<string, number> = {
  eins: 1, ein: 1, eine: 1, einen: 1, zwei: 2, drei: 3, vier: 4, fuenf: 5, sechs: 6, sieben: 7,
  acht: 8, neun: 9, zehn: 10, elf: 11, zwoelf: 12
};

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

function matchExercise(candidate: string, list: { id: string; name: string }[]): { id: string; name: string } | null {
  const c = normalizeText(candidate).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (c.length < 3) return null;
  let best: { score: number; ex: { id: string; name: string } } | null = null;
  for (const ex of list) {
    const full = normalizeText(ex.name).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const base = normalizeText(ex.name.replace(/\(.*?\)/g, '')).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    let score = Infinity;
    for (const n of new Set([full, base])) {
      if (!n) continue;
      if (n === c) score = Math.min(score, 0);
      else if (n.includes(c) || c.includes(n)) score = Math.min(score, 1 + Math.abs(n.length - c.length) / 100);
      else {
        const d = lev(c, n);
        if (d <= 2) score = Math.min(score, 2 + d);
        else {
          // wortweise: jedes Kandidatenwort ähnelt einem Namenswort
          const cw = c.split(' '), nw = n.split(' ');
          if (cw.every((w) => w.length >= 4 && nw.some((x) => lev(w, x) <= 2 || x.includes(w) || w.includes(x)))) score = Math.min(score, 5);
        }
      }
    }
    if (score < Infinity && (!best || score < best.score)) best = { score, ex };
  }
  return best ? best.ex : null;
}

export interface VoiceSet { exerciseId: string; exerciseName: string; weightKg: number; reps: number; sets: number }

export function parseVoiceSet(userId: string, text: string): VoiceSet | null {
  let t = normalizeText(text).replace(/(\d),(\d)/g, '$1.$2');
  t = t.split(' ').map((w) => (w in NUM_WORDS ? String(NUM_WORDS[w]) : w)).join(' ');

  let weight: number | null = null;
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:kg|kilogramm|kilo)\b/, (_, w) => { weight = parseFloat(w); return ' '; });

  let nSets = 1, reps: number | null = null;
  t = t.replace(/(\d+)\s*(?:x|mal|saetze?(?:\s*(?:a|mit|je|zu))?|satz)\s*(\d+)(?:\s*(?:wiederholungen|wdh|reps?|wh)\b)?/, (_, a, b) => {
    nSets = parseInt(a, 10); reps = parseInt(b, 10); return ' ';
  });
  if (reps == null) {
    t = t.replace(/(\d+)\s*(?:wiederholungen|wiederholung|wdh|reps?|wh)\b/, (_, r) => { reps = parseInt(r, 10); return ' '; });
  }
  if (reps == null || nSets < 1 || nSets > 20 || reps < 1 || reps > 100) return null;

  const name = t
    .replace(/\b(mit|a|je|pro|von|und|satz|saetze|sets?|bei|fuer|gewicht|dann|noch|ich|habe|hab|gemacht)\b/g, ' ')
    .replace(/[0-9.,;:x]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const ex = matchExercise(name, listExercises(userId));
  if (!ex) return null;
  return { exerciseId: ex.id, exerciseName: ex.name, weightKg: weight ?? 0, reps, sets: nSets };
}

export function addVoiceSets(userId: string, workoutId: string, text: string): { added: number } {
  const p = parseVoiceSet(userId, text);
  if (!p) return { added: 0 };
  for (let i = 0; i < p.sets; i++) addSet(userId, workoutId, { exerciseId: p.exerciseId, weightKg: p.weightKg, reps: p.reps });
  return { added: p.sets };
}
