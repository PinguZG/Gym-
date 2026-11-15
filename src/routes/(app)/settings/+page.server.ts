import { fail } from '@sveltejs/kit';
import { integrationStatus, runSync } from '$lib/server/integrations/registry';
import type { ProviderId } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({ user: locals.user!, integrations: integrationStatus(locals.user!.id) });

export const actions: Actions = {
  sync: async ({ locals, request }) => {
    const fd = await request.formData();
    const id = String(fd.get('id') ?? '');
    const owner = process.env.HUB_OWNER_EMAIL;
    const live = integrationStatus().find((i) => i.id === id)?.mode === 'live';
    // Live-Sync nutzt globale Zugangsdaten des Sidecars -> nur für den Betreiber
    if (live && (!owner || locals.user!.email.toLowerCase() !== owner.toLowerCase())) {
      return fail(403, { id, error: 'Live-Sync ist nur für den Betreiber erlaubt.' });
    }
    try {
      const r = await runSync(locals.user!.id, id as ProviderId);
      return { ok: true, id, items: r.items };
    } catch (e) {
      console.error('sync failed', id, e);
      return fail(500, { id, error: 'Sync fehlgeschlagen (Details im Server-Log).' });
    }
  }
};
