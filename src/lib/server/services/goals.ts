import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { db, schema } from '../db';
import { GOAL_METRIC_LABELS, type GoalMetric, type GoalProgress } from '../../types';
import { inRange, monthStart, msRange, today, weekStart } from './dates';
import { rangeNutrition } from './nutrition';

const { goals, workouts, sets, bodyMetrics } = schema;

const UNITS: Record<GoalMetric, string> = {
  workouts_per_week: 'Trainings', protein_per_day: 'g', kcal_per_day: 'kcal',
  sets_per_week: 'Sätze', weight_target: 'kg', bodyfat_target: '%'
};

const clamp = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const r1 = (n: number) => Math.round(n * 10) / 10;

function periodRange(period: string): [string, string] {
  const t = today();
  if (period === 'month') return [monthStart(t), t];
  if (period === 'week') return [weekStart(t), t];
  return [t, t];
}

function bodyTarget(userId: string, field: 'weightKg' | 'bodyFatPct', target: number, createdAt: number) {
  const rows = db.select().from(bodyMetrics).where(eq(bodyMetrics.userId, userId)).orderBy(asc(bodyMetrics.measuredAt)).all()
    .filter((r) => r[field] != null);
  if (!rows.length) return { current: 0, ratio: 0 };
  const current = rows[rows.length - 1][field]!;
  const before = rows.filter((r) => r.measuredAt <= createdAt);
  const start = (before.length ? before[before.length - 1] : rows[0])[field]!;
  let ratio: number;
  if (start === target) ratio = current === target ? 1 : 0;
  else ratio = clamp((start - current) / (start - target));
  return { current: r1(current), ratio };
}

export function listGoals(userId: string): GoalProgress[] {
  const rows = db.select().from(goals).where(and(eq(goals.userId, userId), eq(goals.active, true))).orderBy(asc(goals.createdAt)).all();
  return rows.map((g) => {
    const metric = g.metric as GoalMetric;
    const period = g.period as GoalProgress['period'];
    const [from, to] = periodRange(period === 'target' && metric.endsWith('_per_week') ? 'week' : period);
    let current = 0;
    let ratio = 0;
    if (metric === 'workouts_per_week') {
      const [a, b] = msRange(from, to);
      current = db.select({ s: workouts.startedAt }).from(workouts)
        .where(and(eq(workouts.userId, userId), gte(workouts.startedAt, a), lte(workouts.startedAt, b))).all()
        .filter((w) => inRange(w.s, from, to)).length;
      ratio = clamp(current / g.target);
    } else if (metric === 'sets_per_week') {
      const [a, b] = msRange(from, to);
      current = db.select({ s: sets.performedAt }).from(sets)
        .where(and(eq(sets.userId, userId), eq(sets.isWarmup, false), gte(sets.performedAt, a), lte(sets.performedAt, b))).all()
        .filter((x) => inRange(x.s, from, to)).length;
      ratio = clamp(current / g.target);
    } else if (metric === 'protein_per_day' || metric === 'kcal_per_day') {
      const key = metric === 'protein_per_day' ? 'protein' : 'kcal';
      const days = rangeNutrition(userId, from, to).filter((d) => d.kcal > 0 || d.protein > 0);
      current = days.length ? Math.round(days.reduce((s, d) => s + d[key], 0) / days.length) : 0;
      ratio = clamp(current / g.target);
    } else if (metric === 'weight_target' || metric === 'bodyfat_target') {
      ({ current, ratio } = bodyTarget(userId, metric === 'weight_target' ? 'weightKg' : 'bodyFatPct', g.target, g.createdAt));
    }
    return {
      id: g.id, label: g.label?.trim() || GOAL_METRIC_LABELS[metric] || g.metric, metric, period,
      current, target: g.target, ratio, unit: UNITS[metric] ?? ''
    };
  });
}

export function createGoal(
  userId: string,
  g: { metric: string; period: string; target: number; label?: string | null }
): { id: string } {
  const id = crypto.randomUUID();
  db.insert(goals).values({ id, userId, metric: g.metric, period: g.period, target: g.target, label: g.label ?? null }).run();
  return { id };
}

export function deleteGoal(userId: string, id: string): void {
  db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId))).run();
}
