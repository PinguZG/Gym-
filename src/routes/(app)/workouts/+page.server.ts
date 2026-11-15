import { redirect, fail } from '@sveltejs/kit';
import { listWorkouts, startWorkout } from '$lib/server/services/training';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({ workouts: listWorkouts(locals.user!.id, 30) });

export const actions: Actions = {
  start: async ({ locals, request }) => {
    const fd = await request.formData();
    const title = String(fd.get('title') ?? '').trim().slice(0, 80);
    let id: string;
    try {
      id = startWorkout(locals.user!.id, { title: title || undefined }).id;
    } catch {
      return fail(500, { error: 'Training konnte nicht gestartet werden.' });
    }
    redirect(303, `/workouts/${id}`);
  }
};
