import { and, eq } from 'drizzle-orm';
import { db, schema } from '../db';
import type { ProviderId, SyncResult } from '../../types';
import { berlinDate } from './time';

const { workouts, sets, exercises, nutritionEntries, bodyMetrics } = schema;

/**
 * Idempotenter Upsert über UNIQUE(user_id, source, external_id).
 * Sets eines Workouts werden bei jedem Lauf ersetzt (kein Duplikat bei Wiederholung).
 * Zeiten UTC (ms), Datum Europe/Berlin. Gibt Anzahl verarbeiteter Datensätze zurück.
 */
export function upsertResult(userId: string, source: ProviderId, r: SyncResult): { items: number } {
  let items = 0;
  db.transaction((tx) => {
    const exCache = new Map<string, string>();
    const exerciseId = (name: string, muscle?: string): string => {
      const hit = exCache.get(name);
      if (hit) return hit;
      const found = tx.select({ id: exercises.id }).from(exercises)
        .where(and(eq(exercises.userId, userId), eq(exercises.name, name))).get();
      const id = found?.id ?? tx.insert(exercises)
        .values({ userId, name, primaryMuscle: muscle ?? 'brust' }).returning({ id: exercises.id }).get().id;
      exCache.set(name, id);
      return id;
    };

    for (const w of r.workouts) {
      const row = tx.insert(workouts).values({
        userId, source, externalId: w.externalId, startedAt: w.startedAt, endedAt: w.endedAt ?? null, title: w.title ?? null
      }).onConflictDoUpdate({
        target: [workouts.userId, workouts.source, workouts.externalId],
        set: { startedAt: w.startedAt, endedAt: w.endedAt ?? null, title: w.title ?? null }
      }).returning({ id: workouts.id }).get();
      if (w.sets) {
        tx.delete(sets).where(eq(sets.workoutId, row.id)).run();
        w.sets.forEach((s, idx) => {
          tx.insert(sets).values({
            userId, workoutId: row.id, exerciseId: exerciseId(s.exerciseName, s.muscle), idx,
            weightKg: s.weightKg, reps: s.reps, rpe: s.rpe ?? null, performedAt: w.startedAt
          }).run();
        });
      }
      items++;
    }

    for (const n of r.nutrition) {
      const v = { date: n.date, meal: n.meal ?? null, name: n.name, kcal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat };
      tx.insert(nutritionEntries).values({ userId, source, externalId: n.externalId, ...v })
        .onConflictDoUpdate({ target: [nutritionEntries.userId, nutritionEntries.source, nutritionEntries.externalId], set: v }).run();
      items++;
    }

    for (const b of r.body) {
      const v = { date: berlinDate(b.measuredAt), measuredAt: b.measuredAt, weightKg: b.weightKg ?? null, bodyFatPct: b.bodyFatPct ?? null };
      tx.insert(bodyMetrics).values({ userId, source, externalId: b.externalId, ...v })
        .onConflictDoUpdate({ target: [bodyMetrics.userId, bodyMetrics.source, bodyMetrics.externalId], set: v }).run();
      items++;
    }
  });
  return { items };
}
