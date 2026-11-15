import { error, fail } from '@sveltejs/kit';
import { MUSCLE_GROUPS } from '$lib/types';
import type { MuscleGroup } from '$lib/types';
import {
  getWorkout, listExercises, createExercise, addSet, deleteSet, finishWorkout, suggestSet, addVoiceSets
} from '$lib/server/services/training';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
  const w = getWorkout(locals.user!.id, params.id);
  if (!w) error(404, 'Training nicht gefunden');
  return { workout: w, exercises: listExercises(locals.user!.id) };
};

const num = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

export const actions: Actions = {
  addSet: async ({ locals, request, params }) => {
    const fd = await request.formData();
    const exerciseId = String(fd.get('exerciseId') ?? '');
    const weightKg = num(fd.get('weightKg'));
    const reps = Math.round(num(fd.get('reps')));
    const rpeRaw = String(fd.get('rpe') ?? '').trim();
    const rpe = rpeRaw === '' ? undefined : num(rpeRaw);
    if (!exerciseId) return fail(400, { kind: 'error', error: 'Bitte eine Übung wählen.' });
    if (!(weightKg >= 0) || !(reps > 0) || reps > 100 || weightKg > 1000) return fail(400, { kind: 'error', error: 'Gewicht und Wiederholungen prüfen.' });
    if (rpe !== undefined && !(rpe >= 1 && rpe <= 10)) return fail(400, { kind: 'error', error: 'RPE muss zwischen 1 und 10 liegen.' });
    try {
      const r = addSet(locals.user!.id, params.id, { exerciseId, weightKg, reps, rpe, isWarmup: fd.get('isWarmup') === 'on' });
      return { kind: 'set', newPRs: r.newPRs ?? [] };
    } catch {
      return fail(500, { kind: 'error', error: 'Satz konnte nicht gespeichert werden.' });
    }
  },
  deleteSet: async ({ locals, request }) => {
    const fd = await request.formData();
    deleteSet(locals.user!.id, String(fd.get('setId') ?? ''));
    return { kind: 'deleted' };
  },
  finish: async ({ locals, params }) => {
    finishWorkout(locals.user!.id, params.id);
    return { kind: 'finished' };
  },
  newExercise: async ({ locals, request }) => {
    const fd = await request.formData();
    const name = String(fd.get('name') ?? '').trim().slice(0, 80);
    const primaryMuscle = String(fd.get('primaryMuscle') ?? '') as MuscleGroup;
    if (!name) return fail(400, { kind: 'error', error: 'Name fehlt.' });
    if (!MUSCLE_GROUPS.includes(primaryMuscle)) return fail(400, { kind: 'error', error: 'Muskelgruppe wählen.' });
    const { id } = createExercise(locals.user!.id, { name, primaryMuscle });
    return { kind: 'exercise', exerciseId: id, name, primaryMuscle };
  },
  suggest: async ({ locals, request }) => {
    const fd = await request.formData();
    const exerciseId = String(fd.get('exerciseId') ?? '');
    if (!exerciseId) return { kind: 'suggest', suggestion: null };
    return { kind: 'suggest', suggestion: suggestSet(locals.user!.id, exerciseId) ?? null };
  },
  addVoiceSets: async ({ locals, request, params }) => {
    const fd = await request.formData();
    const text = String(fd.get('text') ?? '').trim().slice(0, 300);
    if (!text) return fail(400, { kind: 'error', error: 'Nichts erkannt.' });
    const r = addVoiceSets(locals.user!.id, params.id, text);
    if (!r.added) return fail(400, { kind: 'error', error: `Konnte „${text}“ nicht verstehen. Beispiel: „Kniebeuge 4 mal 8 mit 80 Kilo“.` });
    return { kind: 'voice', added: r.added };
  }
};
