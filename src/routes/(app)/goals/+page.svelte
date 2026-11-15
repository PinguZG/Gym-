<script lang="ts">
  import { enhance } from '$app/forms';
  import Card from '$lib/components/Card.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import { n1 } from '$lib/components/format';
  import { GOAL_METRIC_LABELS } from '$lib/types';
  import type { GoalMetric } from '$lib/types';
  let { data, form } = $props();
</script>

<h1 class="mb-4 text-3xl font-black tracking-tight">Ziele</h1>

<div class="space-y-4">
  {#each data.goals as g (g.id)}
    <Card>
      <div class="mb-3 flex items-start justify-between">
        <div>
          <div class="font-black">{g.label}</div>
          <div class="text-xs text-muted">{g.period === 'week' ? 'Diese Woche' : g.period === 'month' ? 'Dieser Monat' : 'Zielwert'}</div>
        </div>
        <form method="POST" action="?/delete" use:enhance><input type="hidden" name="id" value={g.id} /><button class="text-muted hover:text-danger" aria-label="Ziel löschen">✕</button></form>
      </div>
      <ProgressBar value={g.ratio} max={1} right="{n1(g.current)} / {n1(g.target)} {g.unit}" height="h-3" />
    </Card>
  {:else}
    <p class="text-center text-sm text-muted">Noch keine Ziele.</p>
  {/each}

  <Card title="Neues Ziel">
    <form method="POST" action="?/create" use:enhance class="space-y-3">
      <select name="metric" class="input">
        {#each Object.entries(GOAL_METRIC_LABELS) as [k, v]}<option value={k as GoalMetric}>{v}</option>{/each}
      </select>
      <input name="target" inputmode="decimal" class="input" placeholder="Zielwert, z. B. 4" required />
      <input name="label" class="input" placeholder="Bezeichnung (optional)" maxlength="60" />
      <button class="btn w-full">Ziel anlegen</button>
      {#if form?.error}<p class="text-sm text-danger" role="alert">{form.error}</p>{/if}
    </form>
  </Card>
</div>
