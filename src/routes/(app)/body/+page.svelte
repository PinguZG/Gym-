<script lang="ts">
  import { enhance } from '$app/forms';
  import Card from '$lib/components/Card.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import StatTile from '$lib/components/StatTile.svelte';
  import { n1 } from '$lib/components/format';
  let { data, form } = $props();
</script>

<h1 class="mb-4 text-3xl font-black tracking-tight">Körper</h1>

<div class="space-y-4">
  <div class="grid grid-cols-2 gap-3">
    <StatTile label="Gewicht" value={data.latest?.weightKg != null ? n1(data.latest.weightKg) + ' kg' : '–'} accent />
    <StatTile label="Körperfett" value={data.latest?.bodyFatPct != null ? n1(data.latest.bodyFatPct) + ' %' : '–'} />
  </div>

  <Card title="Gewicht (90 Tage)">
    <LineChart uid="w" series={[{ name: 'Gewicht', points: data.series.filter((p) => p.weightKg != null).map((p) => ({ x: p.date, y: p.weightKg })) }]} />
  </Card>
  <Card title="Körperfett % (90 Tage)">
    <LineChart uid="bf" series={[{ name: 'KFA', color: '#7fb3ff', points: data.series.filter((p) => p.bodyFatPct != null).map((p) => ({ x: p.date, y: p.bodyFatPct })) }]} />
  </Card>

  <Card title="Messung eintragen">
    <form method="POST" action="?/add" use:enhance class="space-y-3">
      <input type="date" name="date" class="input" value={data.today} />
      <div class="grid grid-cols-2 gap-2">
        <div><label class="label" for="w">Gewicht kg</label><input id="w" name="weightKg" inputmode="decimal" class="input" placeholder="80,5" /></div>
        <div><label class="label" for="f">KFA %</label><input id="f" name="bodyFatPct" inputmode="decimal" class="input" placeholder="15,5" /></div>
      </div>
      <button class="btn w-full">Speichern</button>
      {#if form?.error}<p class="text-sm text-danger" role="alert">{form.error}</p>{/if}
    </form>
  </Card>
</div>
