import { fail } from '@sveltejs/kit';
import { dayNutrition, rangeNutrition, listEntries, addEntry, deleteEntry, proteinTarget } from '$lib/server/services/nutrition';
import type { Actions, PageServerLoad } from './$types';

const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
const addDays = (d: string, n: number) => {
  const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10);
};

export const load: PageServerLoad = async ({ locals, url }) => {
  const uid = locals.user!.id;
  const q = url.searchParams.get('date');
  const date = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : today();
  return {
    date,
    isToday: date === today(),
    day: dayNutrition(uid, date),
    entries: listEntries(uid, date),
    target: proteinTarget(uid),
    week: rangeNutrition(uid, addDays(date, -6), date)
  };
};

const num = (v: FormDataEntryValue | null) => { const n = Number(String(v ?? '0').replace(',', '.') || 0); return Number.isFinite(n) ? n : NaN; };

export const actions: Actions = {
  add: async ({ locals, request }) => {
    const fd = await request.formData();
    const name = String(fd.get('name') ?? '').trim().slice(0, 80);
    const date = String(fd.get('date') ?? today());
    const [kcal, protein, carbs, fat] = ['kcal', 'protein', 'carbs', 'fat'].map((k) => num(fd.get(k)));
    if (!name) return fail(400, { error: 'Name fehlt.' });
    if (![kcal, protein, carbs, fat].every((v) => v >= 0 && v < 20000)) return fail(400, { error: 'Zahlen prüfen.' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(400, { error: 'Datum ungültig.' });
    addEntry(locals.user!.id, { date, meal: String(fd.get('meal') ?? '') || undefined, name, kcal, protein, carbs, fat });
    return { ok: true };
  },
  delete: async ({ locals, request }) => {
    const fd = await request.formData();
    deleteEntry(locals.user!.id, String(fd.get('id') ?? ''));
    return { ok: true };
  }
};
