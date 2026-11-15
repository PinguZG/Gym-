// Demo-Daten (idempotent): npm run db:seed
import { hash } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { db, schema } from '../src/lib/server/db';
import { addDays, dateOf, today } from '../src/lib/server/services/dates';
import { recomputePRs } from '../src/lib/server/services/training';

const email = process.env.SEED_EMAIL ?? 'demo@hub.local';
const password = process.env.SEED_PASSWORD ?? 'demo1234';

// deterministischer Zufall
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const round = (n: number, step: number) => Math.round(n / step) * step;
const r1 = (n: number) => Math.round(n * 10) / 10;

// name, Muskel, sekundär, Startgewicht kg, Gewinn/Woche kg
type Ex = [string, string, string[], number, number];
const EX: Ex[] = [
  ['Bankdrücken', 'brust', ['trizeps', 'schultern'], 70, 1.25],
  ['Schrägbankdrücken (Kurzhantel)', 'brust', ['schultern', 'trizeps'], 26, 0.5],
  ['Fliegende (Kabel)', 'brust', [], 15, 0.4],
  ['Schulterdrücken', 'schultern', ['trizeps'], 40, 1],
  ['Seitheben', 'schultern', [], 8, 0.25],
  ['Face Pulls', 'schultern', ['ruecken'], 22, 0.5],
  ['Trizepsdrücken (Kabel)', 'trizeps', [], 27, 0.6],
  ['Dips', 'trizeps', ['brust'], 0, 0],
  ['Skull Crushers', 'trizeps', [], 25, 0.5],
  ['Klimmzüge', 'ruecken', ['bizeps'], 0, 0],
  ['Langhantelrudern', 'ruecken', ['bizeps'], 60, 1.25],
  ['Latzug', 'ruecken', ['bizeps'], 55, 1],
  ['Rudern am Kabel', 'ruecken', ['bizeps'], 50, 1],
  ['Kreuzheben', 'ruecken', ['gesaess', 'beinbeuger'], 100, 2.5],
  ['Bizepscurls (Langhantel)', 'bizeps', [], 30, 0.5],
  ['Hammercurls', 'bizeps', [], 14, 0.4],
  ['Kniebeuge', 'quadrizeps', ['gesaess'], 85, 2.5],
  ['Beinpresse', 'quadrizeps', ['gesaess'], 160, 5],
  ['Ausfallschritte', 'quadrizeps', ['gesaess'], 16, 0.5],
  ['Beinstrecker', 'quadrizeps', [], 45, 1.5],
  ['Rumänisches Kreuzheben', 'beinbeuger', ['gesaess'], 80, 2],
  ['Beinbeuger liegend', 'beinbeuger', [], 40, 1.25],
  ['Hip Thrust', 'gesaess', ['beinbeuger'], 90, 3],
  ['Wadenheben stehend', 'waden', [], 70, 2],
  ['Hängendes Beinheben', 'bauch', [], 0, 0],
  ['Cable Crunch', 'bauch', [], 40, 1]
];

// Tagesplan je Split: [Übung, Sätze, Wdh]
const SPLIT: Record<string, [string, number, number][]> = {
  Push: [['Bankdrücken', 4, 8], ['Schrägbankdrücken (Kurzhantel)', 3, 10], ['Schulterdrücken', 3, 8], ['Seitheben', 3, 14], ['Trizepsdrücken (Kabel)', 3, 12], ['Dips', 3, 10]],
  Pull: [['Kreuzheben', 3, 5], ['Klimmzüge', 4, 8], ['Langhantelrudern', 3, 8], ['Latzug', 3, 10], ['Face Pulls', 3, 15], ['Bizepscurls (Langhantel)', 3, 10], ['Hammercurls', 2, 12]],
  Legs: [['Kniebeuge', 4, 6], ['Rumänisches Kreuzheben', 3, 8], ['Beinpresse', 3, 10], ['Beinbeuger liegend', 3, 12], ['Wadenheben stehend', 4, 12], ['Hängendes Beinheben', 3, 12]],
  Upper: [['Schrägbankdrücken (Kurzhantel)', 3, 10], ['Rudern am Kabel', 3, 10], ['Fliegende (Kabel)', 3, 12], ['Skull Crushers', 3, 10], ['Hammercurls', 3, 12], ['Cable Crunch', 3, 12]]
};
const COMPOUND = new Set(['Bankdrücken', 'Kniebeuge', 'Kreuzheben', 'Schulterdrücken', 'Langhantelrudern']);

const WEEKS = 8;
const t = today();
const startDate = addDays(t, -(WEEKS * 7 - 1));

// ---- Demo-User neu anlegen (Cascade löscht alle Daten) ----
db.delete(schema.users).where(eq(schema.users.email, email)).run();
const userId = crypto.randomUUID();
const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
db.insert(schema.users).values({ id: userId, email, passwordHash, heightCm: 180, proteinGPerKg: 2.0 }).run();

// ---- Übungen ----
const exId = new Map<string, string>();
const exInfo = new Map<string, Ex>();
for (const e of EX) {
  const id = crypto.randomUUID();
  exId.set(e[0], id);
  exInfo.set(e[0], e);
  db.insert(schema.exercises).values({ id, userId, name: e[0], primaryMuscle: e[1], secondaryMuscles: e[2] }).run();
}

// ---- Trainings ----
const dayMs = (date: string, hour: number, min = 0) => Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), hour - 2, min);
let workoutCount = 0, setCount = 0;
for (let i = 0; i < WEEKS * 7; i++) {
  const date = addDays(startDate, i);
  if (date >= t) continue; // heute und Zukunft frei lassen
  const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // 0=Mo
  const weekIdx = Math.floor(i / 7);
  const plan: Record<number, string> = { 0: 'Push', 1: 'Pull', 3: 'Legs' };
  if (weekIdx % 2 === 0) plan[5] = 'Upper';
  const split = plan[dow];
  if (!split) continue;
  if (rnd() < 0.06) continue; // gelegentlich ausgefallen

  const startedAt = dayMs(date, 17, Math.floor(rnd() * 40));
  const endedAt = startedAt + (55 + Math.floor(rnd() * 25)) * 60000;
  const wid = crypto.randomUUID();
  db.insert(schema.workouts).values({ id: wid, userId, startedAt, endedAt, title: split }).run();
  workoutCount++;
  let idx = 0, clock = startedAt;
  for (const [name, nSets, baseReps] of SPLIT[split]) {
    const [, , , w0, gain] = exInfo.get(name)!;
    const step = w0 >= 40 ? 2.5 : 1.25;
    const weight = w0 === 0 ? 0 : round(w0 + gain * weekIdx, step);
    const rows: { w: number; r: number; rpe: number | null; warm: boolean }[] = [];
    if (COMPOUND.has(name) && weight > 0) {
      rows.push({ w: round(weight * 0.5, 2.5), r: 8, rpe: null, warm: true });
      rows.push({ w: round(weight * 0.75, 2.5), r: 5, rpe: null, warm: true });
    }
    for (let s = 0; s < nSets; s++) {
      const drop = s >= nSets - 1 && rnd() < 0.4 ? 1 : 0;
      const bodyweightBonus = w0 === 0 ? Math.floor(weekIdx / 2) : 0;
      rows.push({ w: weight, r: baseReps + bodyweightBonus - drop - (rnd() < 0.15 ? 1 : 0), rpe: r1(7 + rnd() * 2.5 + s * 0.2), warm: false });
    }
    for (const row of rows) {
      clock += (row.warm ? 60 : 120 + Math.floor(rnd() * 60)) * 1000;
      db.insert(schema.sets).values({
        userId, workoutId: wid, exerciseId: exId.get(name)!, idx: idx++, weightKg: row.w, reps: Math.max(1, row.r),
        rpe: row.rpe == null ? null : Math.min(10, row.rpe), isWarmup: row.warm, performedAt: clock
      }).run();
      setCount++;
    }
  }
}
for (const id of exId.values()) recomputePRs(userId, id);

// ---- Ernährung ----
const MEALS: [string, number, string[]][] = [
  ['breakfast', 0.24, ['Haferflocken mit Skyr und Banane', 'Rührei mit Vollkornbrot', 'Quark mit Beeren und Nüssen']],
  ['lunch', 0.32, ['Hähnchen mit Reis und Brokkoli', 'Pasta mit Thunfisch', 'Rindfleisch-Bowl mit Kartoffeln']],
  ['snack', 0.14, ['Proteinshake und Apfel', 'Skyr mit Honig', 'Reiswaffeln mit Erdnussbutter']],
  ['dinner', 0.30, ['Lachs mit Süßkartoffel', 'Omelett mit Gemüse', 'Hackfleisch-Pfanne mit Reis']]
];
let nutCount = 0;
for (let i = 0; i < WEEKS * 7; i++) {
  const date = addDays(startDate, i);
  const kcal = 2600 + (rnd() - 0.5) * 450;
  const protein = 150 + rnd() * 20;
  const fat = (kcal * 0.28) / 9;
  const carbs = (kcal - protein * 4 - fat * 9) / 4;
  for (const [meal, share, names] of MEALS) {
    if (date === t && (meal === 'dinner' || meal === 'snack')) continue; // heute noch unvollständig
    const j = 0.9 + rnd() * 0.2;
    db.insert(schema.nutritionEntries).values({
      userId, date, meal, name: pick(names), kcal: Math.round(kcal * share * j), protein: r1(protein * share * j),
      carbs: r1(carbs * share * j), fat: r1(fat * share * j), source: 'manual'
    }).run();
    nutCount++;
  }
}

// ---- Körper ----
let bodyCount = 0;
for (let i = 0; i < WEEKS * 7; i++) {
  const date = addDays(startDate, i);
  const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  if (!([0, 2, 4].includes(dow) || (dow === 6 && rnd() < 0.5))) continue;
  const p = i / (WEEKS * 7 - 1);
  db.insert(schema.bodyMetrics).values({
    userId, date, measuredAt: date === t ? Date.now() : dayMs(date, 7, 15),
    weightKg: r1(82 - 1.5 * p + (rnd() - 0.5) * 0.6), bodyFatPct: r1(17 - 1.5 * p + (rnd() - 0.5) * 0.3), source: 'manual'
  }).run();
  bodyCount++;
}

// ---- Ziele ----
const created = dayMs(startDate, 8);
db.insert(schema.goals).values([
  { userId, period: 'week', metric: 'workouts_per_week', target: 4, label: '4 Trainings pro Woche', createdAt: created },
  { userId, period: 'week', metric: 'protein_per_day', target: 160, label: '160 g Eiweiß pro Tag', createdAt: created },
  { userId, period: 'target', metric: 'weight_target', target: 78, label: 'Zielgewicht 78 kg', createdAt: created }
]).run();

console.log(`Seed ok für ${email}: ${EX.length} Übungen, ${workoutCount} Trainings, ${setCount} Sätze, ${nutCount} Ernährungseinträge, ${bodyCount} Körpermessungen (${startDate} – ${dateOf(Date.now())})`);
