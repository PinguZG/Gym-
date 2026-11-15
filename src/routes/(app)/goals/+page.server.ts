import { fail } from '@sveltejs/kit';
import { listGoals, createGoal, deleteGoal } from '$lib/server/services/goals';
import type { GoalMetric } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({ goals: listGoals(locals.user!.id) });

const METRICS: Record<GoalMetric, 'week' | 'month' | 'target'> = {
  workouts_per_week: 'week', sets_per_week: 'week', protein_per_day: 'week', kcal_per_day: 'week',
  weight_target: 'target', bodyfat_target: 'target'
};

export const actions: Actions = {
  create: async ({ locals, request }) => {
    const fd = await request.formData();
    const metric = String(fd.get('metric')) as GoalMetric;
    const target = Number(String(fd.get('target') ?? '').replace(',', '.'));
    const label = String(fd.get('label') ?? '').trim().slice(0, 60) || undefined;
    if (!(metric in METRICS)) return fail(400, { error: 'Ziel-Art wählen.' });
    if (!(target > 0) || target > 100000) return fail(400, { error: 'Zielwert ungültig.' });
    createGoal(locals.user!.id, { metric, period: METRICS[metric], target, label });
    return { ok: true };
  },
  delete: async ({ locals, request }) => {
    const fd = await request.formData();
    deleteGoal(locals.user!.id, String(fd.get('id') ?? ''));
    return { ok: true };
  }
};
