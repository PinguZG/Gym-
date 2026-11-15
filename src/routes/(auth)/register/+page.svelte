<script lang="ts">
  import { enhance } from '$app/forms';
  let { form } = $props();
</script>

<div class="text-center mb-8">
  <h1 class="text-7xl font-black tracking-tight text-neon" style="text-shadow: 0 0 28px rgba(57,255,20,.7), 0 0 60px rgba(57,255,20,.35)">HUB</h1>
  <p class="label mt-3">Konto erstellen</p>
</div>

<form method="POST" class="card glow space-y-4" use:enhance>
  <div>
    <label class="label" for="email">E-Mail</label>
    <input class="input mt-1" id="email" name="email" type="email" autocomplete="email" required value={form?.email ?? ''} />
  </div>
  <div>
    <label class="label" for="password">Passwort (min. 10 Zeichen)</label>
    <input class="input mt-1" id="password" name="password" type="password" autocomplete="new-password" minlength="10" required />
  </div>
  {#if form?.error}<p class="text-danger text-sm" role="alert">{form.error}</p>{/if}
  <button class="btn w-full" type="submit">Registrieren</button>
  <p class="text-center text-sm text-muted"><a class="text-neon" href="/login">Zurück zum Login</a></p>
</form>
