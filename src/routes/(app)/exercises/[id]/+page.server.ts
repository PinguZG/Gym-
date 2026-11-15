import { error } from '@sveltejs/kit';
import { listExercises, progression, prs } from '$lib/server/services/training';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
  const uid = locals.user!.id;
  const ex = listExercises(uid).find((e) => e.id === params.id);
  if (!ex) error(404, 'Übung nicht gefunden');
  return {
    exercise: ex,
    points: progression(uid, params.id, 180),
    prs: prs(uid, 500).filter((p) => p.exerciseId === params.id)
  };
};
