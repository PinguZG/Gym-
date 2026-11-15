import { fail } from '@sveltejs/kit';
import { addMetric, bodySeries, latestBody } from '$lib/server/services/body';
import type { Actions, PageServerLoad } from './$types';

const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());

export const load: PageServerLoad = async ({ locals }) => ({
  series: bodySeries(locals.user!.id, 90),
  latest: latestBody(locals.user!.id),
  today: today()
});

const opt = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim().replace(',', '.');
  return s === '' ? undefined : Number(s);
};

export const actions: Actions = {
  add: async ({ locals, request }) => {
    const fd = await request.formData();
    const date = String(fd.get('date') || today());
    const weightKg = opt(fd.get('weightKg'));
    const bodyFatPct = opt(fd.get('bodyFatPct'));
    if (weightKg === undefined && bodyFatPct === undefined) return fail(400, { error: 'Gewicht oder KFA eintragen.' });
    if ((weightKg !== undefined && !(weightKg > 20 && weightKg < 400)) || (bodyFatPct !== undefined && !(bodyFatPct > 2 && bodyFatPct < 70)))
      return fail(400, { error: 'Werte unplausibel.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(400, { error: 'Datum ungültig.' });
    addMetric(locals.user!.id, { date, weightKg, bodyFatPct });
    return { ok: true };
  }
};
