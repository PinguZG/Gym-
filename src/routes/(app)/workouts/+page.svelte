<script lang="ts">
  import { enhance } from '$app/forms';
  import Card from '$lib/components/Card.svelte';
  import { n0, dateLong } from '$lib/components/format';
  let { data, form } = $props();
</script>

<h1 class="mb-4 text-3xl font-black tracking-tight">Training</h1>

<Card class="mb-4">
  <form method="POST" action="?/start" use:enhance class="space-y-3">
    <label class="label" for="title">Titel (optional)</label>
    <input id="title" name="title" class="input" placeholder="z. B. Push, Pull, Beine" maxlength="80" />
    <button class="btn w-full text-lg">Training starten</button>
    {#if form?.error}<p class="text-sm text-danger">{form.error}</p>{/if}
  </form>
</Card>

<div class="space-y-3">
  {#each data.workouts as w (w.id)}
    <a href="/workouts/{w.id}" class="card block">
      <div class="flex items-center justify-between">
        <div class="text-lg font-black">{w.title || 'Training'}</div>
        {#if !w.endedAt}<span class="rounded-full border border-neon px-2 py-0.5 text-[10px] font-extrabold text-neon">LÄUFT</span>{/if}
      </div>
      <div class="mt-1 text-xs text-muted">{dateLong(w.startedAt)} · {n0(w.setCount)} Sätze · {n0(w.volume)} kg Volumen</div>
    </a>
  {:else}
    <p class="text-center text-sm text-muted">Noch keine Trainings.</p>
  {/each}
</div>
