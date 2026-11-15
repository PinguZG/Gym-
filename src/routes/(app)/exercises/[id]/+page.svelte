<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import { MUSCLE_LABELS } from '$lib/types';
  import type { MuscleGroup } from '$lib/types';
  import { n1, dateShort } from '$lib/components/format';
  let { data } = $props();
  const kinds = { max_weight: 'Max. Gewicht', est_1rm: 'Geschätztes 1RM', max_volume: 'Max. Volumen (Satz)' } as const;
</script>

<a href="/workouts" class="text-sm text-muted">‹ Training</a>
<h1 class="mb-1 mt-1 text-3xl font-black tracking-tight">{data.exercise.name}</h1>
<p class="mb-4 text-xs text-muted">{MUSCLE_LABELS[data.exercise.primaryMuscle as MuscleGroup] ?? data.exercise.primaryMuscle}</p>

<div class="space-y-4">
  <Card title="Progression (kg)">
    <LineChart uid="prog" unit="kg" series={[
      { name: 'Top-Gewicht', points: data.points.map((p) => ({ x: p.date, y: p.topWeightKg })) },
      { name: 'Gesch. 1RM', points: data.points.map((p) => ({ x: p.date, y: p.est1rm })) }
    ]} />
  </Card>
  <Card title="Bestleistungen">
    {#if data.prs.length === 0}
      <p class="text-sm text-muted">Noch keine PRs.</p>
    {:else}
      <ul class="divide-y divide-line">
        {#each data.prs as p}
          <li class="flex items-center justify-between py-2.5 text-sm">
            <span>{kinds[p.kind]}<span class="ml-2 text-xs text-muted">{dateShort(p.achievedAt)}</span></span>
            <span class="font-black text-neon">{n1(p.value)} kg</span>
          </li>
        {/each}
      </ul>
    {/if}
  </Card>
</div>
