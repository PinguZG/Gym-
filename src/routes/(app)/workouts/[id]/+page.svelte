<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import Card from '$lib/components/Card.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import { n1, n0, dateLong } from '$lib/components/format';
  import { MUSCLE_GROUPS, MUSCLE_LABELS } from '$lib/types';
  import type { SuggestedSet, PR } from '$lib/types';

  let { data } = $props();
  const w = $derived(data.workout);
  const finished = $derived(!!w.endedAt);

  let exerciseId = $state('');
  let weight = $state(20);
  let reps = $state(8);
  let rpe = $state<number | null>(null);
  let suggestion = $state<SuggestedSet | null>(null);
  let toast = $state('');
  let error = $state('');
  let showNew = $state(false);
  let extraExercises = $state<{ id: string; name: string }[]>([]);
  let suggestForm = $state<HTMLFormElement>();
  let voiceText = $state('');
  let voiceForm = $state<HTMLFormElement>();
  let listening = $state(false);

  const allExercises = $derived([...data.exercises.map((e) => ({ id: e.id, name: e.name })), ...extraExercises.filter((x) => !data.exercises.some((e) => e.id === x.id))].sort((a, b) => a.name.localeCompare(b.name, 'de')));

  const step = (set: (v: number) => void, cur: number, d: number, min = 0, max = 1000) => set(Math.round(Math.min(max, Math.max(min, cur + d)) * 100) / 100);
  const fmtNum = (v: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(v);
  const parseNum = (s: string) => Number(s.replace(',', '.'));

  function applySuggestion() {
    if (!suggestion) return;
    weight = suggestion.weightKg;
    reps = suggestion.reps;
    rpe = suggestion.rpe;
  }

  function onPick() {
    suggestion = null;
    if (exerciseId) suggestForm?.requestSubmit();
  }

  function handle(result: any) {
    const r = result?.data;
    if (!r) return;
    if (r.kind === 'error') { error = r.error; return; }
    error = '';
    if (r.kind === 'suggest') suggestion = r.suggestion;
    if (r.kind === 'exercise') {
      extraExercises = [...extraExercises, { id: r.exerciseId, name: r.name }];
      exerciseId = r.exerciseId; showNew = false; suggestion = null;
    }
    if (r.kind === 'set') {
      const prs: PR[] = r.newPRs ?? [];
      if (prs.length) toast = '🏆 Neuer PR: ' + prs.map((p) => `${p.exerciseName} ${n1(p.value)} kg`).join(', ');
      if (exerciseId) suggestForm?.requestSubmit();
    }
    if (r.kind === 'voice') toast = `${r.added} ${r.added === 1 ? 'Satz' : 'Sätze'} per Sprache hinzugefügt`;
  }

  const enh = () => async ({ result, update }: any) => {
    if (result.type === 'success' || result.type === 'failure') handle(result);
    if (result.type === 'success' && result.data?.kind === 'suggest') return;
    if (result.type === 'success' && result.data?.kind === 'exercise') { await invalidateAll(); return; }
    await update({ reset: false, invalidateAll: result.data?.kind !== 'suggest' });
  };

  // Sprache
  function listen() {
    error = '';
    const Ctor: any = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!Ctor) { error = 'Spracheingabe wird von diesem Browser nicht unterstützt (z. B. Chrome/Safari nutzen).'; return; }
    const rec = new Ctor();
    rec.lang = 'de-DE';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    listening = true;
    rec.onresult = (e: any) => { voiceText = e.results[0][0].transcript; setTimeout(() => voiceForm?.requestSubmit(), 0); };
    rec.onerror = (e: any) => { listening = false; error = e.error === 'not-allowed' ? 'Mikrofon-Zugriff verweigert.' : 'Spracherkennung fehlgeschlagen (' + e.error + ').'; };
    rec.onend = () => { listening = false; };
    try { rec.start(); } catch { listening = false; error = 'Spracherkennung konnte nicht gestartet werden.'; }
  }
</script>

<Toast message={toast} onclose={() => (toast = '')} />

<a href="/workouts" class="text-sm text-muted">‹ Training</a>
<h1 class="mb-1 mt-1 text-3xl font-black tracking-tight">{w.title || 'Training'}</h1>
<p class="mb-4 text-xs text-muted">{dateLong(w.startedAt)}{finished ? ' · beendet' : ' · läuft'}</p>

{#if !finished}
  <Card class="mb-4" title="Satz erfassen">
    <form bind:this={suggestForm} method="POST" action="?/suggest" use:enhance={enh} class="hidden"><input type="hidden" name="exerciseId" value={exerciseId} /></form>

    <div class="flex gap-2">
      <select class="input" bind:value={exerciseId} onchange={onPick} aria-label="Übung">
        <option value="">Übung wählen…</option>
        {#each allExercises as e (e.id)}<option value={e.id}>{e.name}</option>{/each}
      </select>
      <button type="button" class="btn-ghost shrink-0" onclick={() => (showNew = !showNew)}>{showNew ? '×' : '+ Neu'}</button>
    </div>

    {#if showNew}
      <form method="POST" action="?/newExercise" use:enhance={enh} class="mt-3 space-y-2 rounded-2xl border border-line p-3">
        <input name="name" class="input" placeholder="Name der Übung" required maxlength="80" />
        <select name="primaryMuscle" class="input" required>
          {#each MUSCLE_GROUPS as m}<option value={m}>{MUSCLE_LABELS[m]}</option>{/each}
        </select>
        <button class="btn w-full">Übung anlegen</button>
      </form>
    {/if}

    {#if suggestion}
      <button type="button" onclick={applySuggestion} class="glow mt-3 w-full rounded-2xl border border-neon bg-card-2 px-4 py-3 text-left">
        <div class="text-sm font-extrabold text-neon">{suggestion.hint}</div>
        <div class="text-xs text-muted">{fmtNum(suggestion.weightKg)} kg × {suggestion.reps}{suggestion.rpe ? ` @ RPE ${fmtNum(suggestion.rpe)}` : ''} · Tippen zum Übernehmen</div>
      </button>
    {/if}

    <form method="POST" action="?/addSet" use:enhance={enh} class="mt-4 space-y-4">
      <input type="hidden" name="exerciseId" value={exerciseId} />
      {#each [
        { key: 'w', label: 'Gewicht (kg)', name: 'weightKg', d: 2.5 },
        { key: 'r', label: 'Wiederholungen', name: 'reps', d: 1 },
        { key: 'p', label: 'RPE (optional)', name: 'rpe', d: 0.5 }
      ] as f}
        <div>
          <div class="label mb-1.5">{f.label}</div>
          <div class="flex items-center gap-2">
            <button type="button" class="btn-ghost h-14 w-14 shrink-0 text-2xl" aria-label="weniger"
              onclick={() => f.key === 'w' ? step((v) => (weight = v), weight, -f.d) : f.key === 'r' ? step((v) => (reps = v), reps, -f.d, 1, 100) : step((v) => (rpe = v <= 5 ? null : v), rpe ?? 8, -f.d, 5, 10)}>−</button>
            {#if f.key === 'w'}
              <input name={f.name} inputmode="decimal" class="input h-14 text-center text-2xl font-black" value={fmtNum(weight)} oninput={(e) => { const v = parseNum(e.currentTarget.value); if (Number.isFinite(v)) weight = v; }} />
            {:else if f.key === 'r'}
              <input name={f.name} inputmode="numeric" class="input h-14 text-center text-2xl font-black" value={reps} oninput={(e) => { const v = parseNum(e.currentTarget.value); if (Number.isFinite(v)) reps = v; }} />
            {:else}
              <input name={f.name} inputmode="decimal" placeholder="–" class="input h-14 text-center text-2xl font-black" value={rpe == null ? '' : fmtNum(rpe)} oninput={(e) => { const s = e.currentTarget.value.trim(); if (s === '') rpe = null; else { const v = parseNum(s); if (Number.isFinite(v)) rpe = v; } }} />
            {/if}
            <button type="button" class="btn-ghost h-14 w-14 shrink-0 text-2xl" aria-label="mehr"
              onclick={() => f.key === 'w' ? step((v) => (weight = v), weight, f.d) : f.key === 'r' ? step((v) => (reps = v), reps, f.d, 1, 100) : step((v) => (rpe = v), rpe ?? 7.5, f.d, 5, 10)}>+</button>
          </div>
        </div>
      {/each}
      <label class="flex items-center gap-2 text-sm text-muted"><input type="checkbox" name="isWarmup" class="accent-[#39ff14]" /> Aufwärmsatz</label>
      <button class="btn w-full py-4 text-lg" disabled={!exerciseId}>Satz speichern</button>
    </form>

    <form bind:this={voiceForm} method="POST" action="?/addVoiceSets" use:enhance={enh} class="mt-3">
      <input type="hidden" name="text" value={voiceText} />
      <button type="button" class="btn-ghost flex w-full items-center justify-center gap-2 {listening ? 'border-neon text-neon glow' : ''}" onclick={listen}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
        {listening ? 'Ich höre zu…' : 'Per Sprache loggen'}
      </button>
    </form>

    {#if error}<p class="mt-3 text-sm text-danger" role="alert">{error}</p>{/if}
  </Card>
{/if}

<div class="space-y-3">
  {#each w.exercises as ex (ex.exerciseId)}
    <Card>
      <div class="mb-2 flex items-center justify-between">
        <a href="/exercises/{ex.exerciseId}" class="text-lg font-black">{ex.name}</a>
        <span class="text-xs text-muted">{ex.sets.length} Sätze</span>
      </div>
      <ul class="divide-y divide-line">
        {#each ex.sets as s, i (s.id)}
          <li class="flex items-center justify-between py-2 text-sm">
            <span class="w-6 text-muted">{i + 1}</span>
            <span class="flex-1 font-black tabular-nums">{fmtNum(s.weightKg)} kg × {s.reps}{s.isWarmup ? ' (AW)' : ''}</span>
            <span class="mr-3 text-xs text-muted">{s.rpe ? 'RPE ' + fmtNum(s.rpe) : ''}</span>
            {#if !finished}
              <form method="POST" action="?/deleteSet" use:enhance={enh}>
                <input type="hidden" name="setId" value={s.id} />
                <button class="text-muted hover:text-danger" aria-label="Satz löschen">✕</button>
              </form>
            {/if}
          </li>
        {/each}
      </ul>
    </Card>
  {:else}
    <p class="text-center text-sm text-muted">Noch keine Sätze.</p>
  {/each}
</div>

{#if !finished}
  <form method="POST" action="?/finish" use:enhance={enh} class="mt-6">
    <button class="btn-ghost w-full border-neon py-3 font-extrabold text-neon">Training beenden</button>
  </form>
{/if}
