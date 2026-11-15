import { and, asc, eq, gte } from 'drizzle-orm';
import { db, schema } from '../db';
import { MUSCLE_GROUPS, type DayNutrition, type GoalProgress, type MuscleGroup, type PR } from '../../types';
import { addDays, dateOf, inRange, monthStart, msRange, today, weekStart } from './dates';
import { rangeNutrition, proteinTarget } from './nutrition';
import { latestBody } from './body';
import { listGoals } from './goals';
import { listWorkouts, prs, weeklySetsByMuscle } from './training';

const { workouts, sets, bodyMetrics, exercises } = schema;

export interface DashboardData {
  today: { kcal: number; protein: number; proteinTarget: number | null; workoutDone: boolean; weightKg: number | null };
  week: { workouts: number; sets: number; volume: number; muscles: Record<MuscleGroup, number>; nutritionDays: DayNutrition[] };
  month: { workouts: number; avgProtein: number; weightDelta: number | null };
  goals: GoalProgress[];
  prs: PR[];
  lastWorkout: { id: string; title: string | null; startedAt: number; endedAt: number | null; setCount: number; volume: number; exercises: string[] } | null;
}

export function dashboard(userId: string): DashboardData {
  const t = today();
  const ws = weekStart(t);
  const ms = monthStart(t);

  // Workouts seit Monatsanfang (Woche kann vor Monatsanfang beginnen)
  const from = ws < ms ? ws : ms;
  const [a] = msRange(from, from);
  const wo = db.select({ s: workouts.startedAt }).from(workouts).where(and(eq(workouts.userId, userId), gte(workouts.startedAt, a))).all().map((w) => dateOf(w.s));
  const weekWorkouts = wo.filter((d) => d >= ws && d <= addDays(ws, 6)).length;
  const monthWorkouts = wo.filter((d) => d >= ms).length;

  const setRows = db
    .select({ at: sets.performedAt, w: sets.weightKg, r: sets.reps })
    .from(sets)
    .where(and(eq(sets.userId, userId), eq(sets.isWarmup, false), gte(sets.performedAt, msRange(ws, ws)[0])))
    .all()
    .filter((s) => inRange(s.at, ws, addDays(ws, 6)));
  const volume = Math.round(setRows.reduce((s, x) => s + x.w * x.r, 0));

  const nutritionDays = rangeNutrition(userId, ws, addDays(ws, 6));
  const todayN = nutritionDays.find((d) => d.date === t) ?? { kcal: 0, protein: 0 };
  const monthN = rangeNutrition(userId, ms, t).filter((d) => d.protein > 0);
  const avgProtein = monthN.length ? Math.round(monthN.reduce((s, d) => s + d.protein, 0) / monthN.length) : 0;

  const bodyRows = db.select().from(bodyMetrics).where(and(eq(bodyMetrics.userId, userId), gte(bodyMetrics.date, ms))).orderBy(asc(bodyMetrics.measuredAt)).all()
    .filter((r) => r.weightKg != null);
  const weightDelta = bodyRows.length >= 2 ? Math.round((bodyRows[bodyRows.length - 1].weightKg! - bodyRows[0].weightKg!) * 10) / 10 : null;

  const last = listWorkouts(userId, 1)[0] ?? null;
  let lastWorkout: DashboardData['lastWorkout'] = null;
  if (last) {
    const names = db
      .selectDistinct({ name: exercises.name, idx: sets.idx })
      .from(sets).innerJoin(exercises, eq(exercises.id, sets.exerciseId))
      .where(and(eq(sets.workoutId, last.id), eq(sets.userId, userId))).orderBy(asc(sets.idx)).all();
    lastWorkout = { ...last, exercises: [...new Set(names.map((n) => n.name))] };
  }

  return {
    today: {
      kcal: todayN.kcal,
      protein: todayN.protein,
      proteinTarget: proteinTarget(userId).grams,
      workoutDone: wo.includes(t),
      weightKg: latestBody(userId)?.weightKg ?? null
    },
    week: {
      workouts: weekWorkouts,
      sets: setRows.length,
      volume,
      muscles: weeklySetsByMuscle(userId, 1)[0]?.sets ?? (Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, 0])) as Record<MuscleGroup, number>),
      nutritionDays
    },
    month: { workouts: monthWorkouts, avgProtein, weightDelta },
    goals: listGoals(userId),
    prs: prs(userId, 5),
    lastWorkout
  };
}
