import { fail } from '@sveltejs/kit';
import { integrationStatus, runSync } from '$lib/server/integrations/registry';
import type { ProviderId } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({ user: locals.user!, integrations: integrationStatus() });

export const actions: Actions = {
  sync: async ({ locals, request }) => {
    const fd = await request.formData();
    const id = String(fd.get('id') ?? '');
    try {
      const r = await runSync(locals.user!.id, id as ProviderId);
      return { ok: true, id, items: r.items };
    } catch (e) {
      return fail(500, { id, error: e instanceof Error ? e.message : 'Sync fehlgeschlagen.' });
    }
  }
};
