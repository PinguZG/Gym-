<script lang="ts">
  import { enhance } from '$app/forms';
  let { data, form } = $props();
  let busy = $state(false);
</script>

<div class="text-center mb-8">
  <h1 class="text-7xl font-black tracking-tight text-neon" style="text-shadow: 0 0 28px rgba(57,255,20,.7), 0 0 60px rgba(57,255,20,.35)">HUB</h1>
  <p class="label mt-3">Training · Ernährung · Körper</p>
</div>

<form
  method="POST"
  class="card glow space-y-4"
  use:enhance={() => {
    busy = true;
    return async ({ update }) => {
      await update({ reset: false });
      busy = false;
    };
  }}
>
  <div>
    <label class="label" for="email">E-Mail</label>
    <input class="input mt-1" id="email" name="email" type="email" autocomplete="email" required value={form?.email ?? ''} />
  </div>
  <div>
    <label class="label" for="password">Passwort</label>
    <input class="input mt-1" id="password" name="password" type="password" autocomplete="current-password" required />
  </div>
  {#if form?.error}
    <p class="text-danger text-sm" role="alert">{form.error}</p>
  {/if}
  <button class="btn w-full" type="submit" disabled={busy}>{busy ? 'Einen Moment…' : 'Anmelden'}</button>
  {#if data.registration}
    <p class="text-center text-sm text-muted"><a class="text-neon" href="/register">Konto erstellen</a></p>
  {/if}
</form>
