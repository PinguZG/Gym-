import { dashboard } from '$lib/server/services/dashboard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  return { d: dashboard(locals.user!.id) };
};
