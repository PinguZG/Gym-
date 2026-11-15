import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { db, schema } from '../db';
import type { DayNutrition } from '../../types';
import { addDays } from './dates';
import { latestBody } from './body';

const { nutritionEntries, users } = schema;

export function dayNutrition(userId: string, date: string): DayNutrition {
  return rangeNutrition(userId, date, date)[0];
}

export function rangeNutrition(userId: string, fromDate: string, toDate: string): DayNutrition[] {
  const rows = db
    .select()
    .from(nutritionEntries)
    .where(and(eq(nutritionEntries.userId, userId), gte(nutritionEntries.date, fromDate), lte(nutritionEntries.date, toDate)))
    .all();
  const map = new Map<string, DayNutrition>();
  for (const r of rows) {
    const d = map.get(r.date) ?? { date: r.date, kcal: 0, protein: 0, carbs: 0, fat: 0 };
    d.kcal += r.kcal;
    d.protein += r.protein;
    d.carbs += r.carbs;
    d.fat += r.fat;
    map.set(r.date, d);
  }
  const out: DayNutrition[] = [];
  for (let d = fromDate, i = 0; d <= toDate && i < 3700; d = addDays(d, 1), i++) {
    const v = map.get(d) ?? { date: d, kcal: 0, protein: 0, carbs: 0, fat: 0 };
    out.push({ date: d, kcal: Math.round(v.kcal), protein: Math.round(v.protein * 10) / 10, carbs: Math.round(v.carbs * 10) / 10, fat: Math.round(v.fat * 10) / 10 });
  }
  return out;
}

export function listEntries(
  userId: string,
  date: string
): { id: string; meal: string | null; name: string; kcal: number; protein: number; carbs: number; fat: number }[] {
  return db
    .select({
      id: nutritionEntries.id,
      meal: nutritionEntries.meal,
      name: nutritionEntries.name,
      kcal: nutritionEntries.kcal,
      protein: nutritionEntries.protein,
      carbs: nutritionEntries.carbs,
      fat: nutritionEntries.fat
    })
    .from(nutritionEntries)
    .where(and(eq(nutritionEntries.userId, userId), eq(nutritionEntries.date, date)))
    .orderBy(asc(nutritionEntries.createdAt))
    .all();
}

export function addEntry(
  userId: string,
  e: { date: string; meal?: string | null; name: string; kcal: number; protein: number; carbs: number; fat: number }
): { id: string } {
  const id = crypto.randomUUID();
  db.insert(nutritionEntries)
    .values({ id, userId, date: e.date, meal: e.meal ?? null, name: e.name, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat, source: 'manual' })
    .run();
  return { id };
}

export function deleteEntry(userId: string, id: string): void {
  db.delete(nutritionEntries).where(and(eq(nutritionEntries.id, id), eq(nutritionEntries.userId, userId))).run();
}

export function proteinTarget(userId: string): { perKg: number; weightKg: number | null; grams: number | null } {
  const u = db.select({ p: users.proteinGPerKg }).from(users).where(eq(users.id, userId)).get();
  const perKg = u?.p ?? 2.0;
  const weightKg = latestBody(userId)?.weightKg ?? null;
  return { perKg, weightKg, grams: weightKg != null ? Math.round(perKg * weightKg) : null };
}
