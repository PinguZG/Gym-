<script lang="ts">
  import { enhance } from '$app/forms';
  import Card from '$lib/components/Card.svelte';
  import { dateLong, n0 } from '$lib/components/format';
  let { data, form } = $props();
  let busy = $state('');
  const modeLabel = { off: 'Aus', mock: 'Demo (Mock)', live: 'Live' } as const;
</script>

<h1 class="mb-4 text-3xl font-black tracking-tight">Einstellungen</h1>

<div class="space-y-4">
  <Card title="Konto">
    <div class="flex items-center justify-between">
      <span class="text-sm text-muted">{data.user.email}</span>
      <form method="POST" action="/logout"><button class="btn-ghost">Abmelden</button></form>
    </div>
  </Card>

  <h2 class="label pt-2">Integrationen</h2>
  {#each data.integrations as i (i.id)}
    <Card>
      <div class="flex items-center justify-between">
        <div class="text-lg font-black">{i.label}</div>
        <span class="rounded-full border px-2 py-0.5 text-[10px] font-extrabold {i.mode === 'live' ? 'border-neon text-neon' : 'border-line text-muted'}">{modeLabel[i.mode]}</span>
      </div>
      <div class="mt-1 text-xs text-muted">
        {#if i.lastRun}Letzter Sync: {dateLong(i.lastRun.at)} · {i.lastRun.status} · {n0(i.lastRun.items)} Einträge{:else}Noch nie synchronisiert{/if}
      </div>
      <p class="mt-2 text-xs text-muted">⚠ {i.risk}</p>
      <form method="POST" action="?/sync" class="mt-3" use:enhance={() => { busy = i.id; return async ({ update }) => { await update({ reset: false }); busy = ''; }; }}>
        <input type="hidden" name="id" value={i.id} />
        <button class="btn-ghost w-full" disabled={i.mode === 'off' || busy === i.id}>{busy === i.id ? 'Synchronisiere…' : 'Sync jetzt'}</button>
      </form>
      {#if form?.id === i.id}
        {#if form.error}<p class="mt-2 text-sm text-danger" role="alert">{form.error}</p>{:else if form.ok}<p class="mt-2 text-sm text-neon">{n0(form.items)} Einträge synchronisiert.</p>{/if}
      {/if}
    </Card>
  {/each}
</div>
