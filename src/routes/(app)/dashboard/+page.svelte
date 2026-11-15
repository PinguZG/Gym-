<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import StatTile from '$lib/components/StatTile.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import BarChart from '$lib/components/BarChart.svelte';
  import Ring from '$lib/components/Ring.svelte';
  import { n0, n1, dateLong } from '$lib/components/format';
  import { MUSCLE_GROUPS, MUSCLE_LABELS } from '$lib/types';
  let { data } = $props();
  const d = $derived(data.d);
  const muscles = $derived(
    MUSCLE_GROUPS.map((m) => ({ label: MUSCLE_LABELS[m], value: d.week.muscles?.[m] ?? 0 })).sort((a, b) => b.value - a.value)
  );
  const prKind = { max_weight: 'Max. Gewicht', est_1rm: 'Gesch. 1RM', max_volume: 'Max. Volumen' } as const;
  const last = $derived(d.lastWorkout as any);
</script>

<h1 class="mb-4 text-3xl font-black tracking-tight">Heute</h1>

<div class="space-y-4">
  <Card>
    <div class="flex items-center justify-around">
      <Ring value={d.today.kcal} max={2600} text={n0(d.today.kcal)} label="kcal" />
      <Ring value={d.today.protein} max={d.today.proteinTarget || 160} text="{n0(d.today.protein)} g" label="Eiweiß" />
      <Ring value={d.today.workoutDone ? 1 : 0} max={1} text={d.today.workoutDone ? '✓' : '–'} label="Training" />
    </div>
    <p class="mt-3 text-center text-xs text-muted">
      Eiweißziel {n0(d.today.proteinTarget)} g · Gewicht {n1(d.today.weightKg)} kg
    </p>
  </Card>

  <Card title="Diese Woche">
    <div class="grid grid-cols-3 gap-2">
      <StatTile label="Trainings" value={n0(d.week.workouts)} accent />
      <StatTile label="Sätze" value={n0(d.week.sets)} />
      <StatTile label="Volumen" value="{n1(d.week.volume / 1000)} t" />
    </div>
  </Card>

  <Card title="Letzte 30 Tage">
    <div class="grid grid-cols-3 gap-2">
      <StatTile label="Trainings" value={n0(d.month.workouts)} />
      <StatTile label="Ø Eiweiß" value="{n0(d.month.avgProtein)} g" />
      <StatTile label="Gewicht" value={d.month.weightDelta == null ? '–' : (d.month.weightDelta > 0 ? '+' : '') + n1(d.month.weightDelta) + ' kg'} />
    </div>
  </Card>

  <Card title="Sätze pro Muskelgruppe (Woche)">
    <BarChart items={muscles} />
  </Card>

  <Card title="Ziele">
    {#if d.goals.length === 0}
      <p class="text-sm text-muted">Noch keine Ziele. <a href="/goals" class="text-neon">Ziel anlegen</a></p>
    {:else}
      <div class="space-y-4">
        {#each d.goals as g (g.id)}
          <ProgressBar value={g.current} max={g.target} label={g.label} right="{n1(g.current)} / {n1(g.target)} {g.unit}" />
        {/each}
      </div>
    {/if}
  </Card>

  <Card title="Bestleistungen">
    {#if d.prs.length === 0}
      <p class="text-sm text-muted">Noch keine PRs.</p>
    {:else}
      <ul class="divide-y divide-line">
        {#each d.prs.slice(0, 5) as p}
          <li class="flex items-center justify-between py-2.5 text-sm">
            <a href="/exercises/{p.exerciseId}" class="min-w-0 truncate">{p.exerciseName}<span class="ml-2 text-xs text-muted">{prKind[p.kind]}</span></a>
            <span class="font-black text-neon">{n1(p.value)} kg</span>
          </li>
        {/each}
      </ul>
    {/if}
  </Card>

  <Card title="Letztes Training">
    {#if last}
      <a href="/workouts/{last.id}" class="flex items-center justify-between">
        <div>
          <div class="text-lg font-black">{last.title ?? 'Training'}</div>
          <div class="text-xs text-muted">{last.startedAt ? dateLong(last.startedAt) : ''}{last.setCount != null ? ` · ${n0(last.setCount)} Sätze` : ''}{last.volume != null ? ` · ${n0(last.volume)} kg` : ''}</div>
        </div>
        <span class="text-neon">›</span>
      </a>
    {:else}
      <p class="text-sm text-muted">Noch kein Training.</p>
    {/if}
  </Card>
</div>
