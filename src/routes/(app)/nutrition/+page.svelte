<script lang="ts">
  import { enhance } from '$app/forms';
  import Card from '$lib/components/Card.svelte';
  import Ring from '$lib/components/Ring.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import BarChart from '$lib/components/BarChart.svelte';
  import { n0, n1, dateShort } from '$lib/components/format';
  let { data, form } = $props();
  const d = $derived(data.day);
  const tp = $derived(data.target.grams ?? 160);
  const MEALS = ['Frühstück', 'Mittag', 'Abend', 'Snack'];
  const mealDe: Record<string, string> = { breakfast: 'Frühstück', lunch: 'Mittag', dinner: 'Abend', snack: 'Snack' };
  const prev = $derived(shift(data.date, -1));
  const next = $derived(shift(data.date, 1));
  function shift(s: string, n: number) { const t = new Date(s + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
</script>

<div class="mb-4 flex items-center justify-between">
  <a href="?date={prev}" class="btn-ghost" aria-label="Vortag">‹</a>
  <h1 class="text-2xl font-black tracking-tight">{data.isToday ? 'Heute' : dateShort(data.date)}</h1>
  {#if data.isToday}<span class="w-12"></span>{:else}<a href="?date={next}" class="btn-ghost" aria-label="Folgetag">›</a>{/if}
</div>

<div class="space-y-4">
  <Card>
    <div class="flex items-center justify-around">
      <Ring value={d.kcal} max={2600} text={n0(d.kcal)} label="kcal" size={100} />
      <Ring value={d.protein} max={tp} text="{n0(d.protein)} g" label="Eiweiß" size={100} />
    </div>
    <div class="mt-4 space-y-3">
      <ProgressBar value={d.protein} max={tp} label="Eiweißziel" right="{n0(d.protein)} / {n0(tp)} g" />
      <ProgressBar value={d.carbs} max={300} label="Kohlenhydrate" right="{n0(d.carbs)} g" />
      <ProgressBar value={d.fat} max={90} label="Fett" right="{n0(d.fat)} g" />
    </div>
    <p class="mt-3 text-xs text-muted">
      {#if data.target.grams}Ziel: {n1(data.target.perKg)} g/kg × {n1(data.target.weightKg)} kg = {n0(data.target.grams)} g{:else}Ziel: {n1(data.target.perKg)} g/kg (Gewicht eintragen für Gramm-Ziel){/if}
    </p>
  </Card>

  <Card title="Eintrag hinzufügen">
    <form method="POST" action="?/add" use:enhance class="space-y-3">
      <input type="hidden" name="date" value={data.date} />
      <input name="name" class="input" placeholder="Was hast du gegessen?" required maxlength="80" />
      <select name="meal" class="input"><option value="">Mahlzeit</option>{#each MEALS as m}<option>{m}</option>{/each}</select>
      <div class="grid grid-cols-2 gap-2">
        <div><label class="label" for="kcal">kcal</label><input id="kcal" name="kcal" inputmode="decimal" class="input" value="0" /></div>
        <div><label class="label" for="protein">Eiweiß g</label><input id="protein" name="protein" inputmode="decimal" class="input" value="0" /></div>
        <div><label class="label" for="carbs">Kohlenh. g</label><input id="carbs" name="carbs" inputmode="decimal" class="input" value="0" /></div>
        <div><label class="label" for="fat">Fett g</label><input id="fat" name="fat" inputmode="decimal" class="input" value="0" /></div>
      </div>
      <button class="btn w-full">Hinzufügen</button>
      {#if form?.error}<p class="text-sm text-danger" role="alert">{form.error}</p>{/if}
    </form>
  </Card>

  <Card title="Einträge">
    <ul class="divide-y divide-line">
      {#each data.entries as e (e.id)}
        <li class="flex items-center justify-between gap-2 py-2.5 text-sm">
          <div class="min-w-0">
            <div class="truncate font-extrabold">{e.name}</div>
            <div class="text-xs text-muted">{e.meal ? (mealDe[e.meal.toLowerCase()] ?? e.meal) + ' · ' : ''}{n0(e.kcal)} kcal · E {n0(e.protein)} · K {n0(e.carbs)} · F {n0(e.fat)}</div>
          </div>
          <form method="POST" action="?/delete" use:enhance><input type="hidden" name="id" value={e.id} /><button class="text-muted hover:text-danger" aria-label="Löschen">✕</button></form>
        </li>
      {:else}
        <li class="py-2 text-sm text-muted">Noch nichts eingetragen.</li>
      {/each}
    </ul>
  </Card>

  <Card title="Eiweiß – letzte 7 Tage">
    <BarChart items={data.week.map((x) => ({ label: dateShort(x.date), value: x.protein }))} max={Math.max(tp, ...data.week.map((x) => x.protein))} unit="" />
    <p class="mt-3 text-xs text-muted">Ø {n0(data.week.reduce((a, x) => a + x.kcal, 0) / (data.week.length || 1))} kcal / Tag</p>
  </Card>
</div>
