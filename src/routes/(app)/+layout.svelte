<script lang="ts">
  import { page } from '$app/state';
  let { children } = $props();

  const tabs = [
    { href: '/dashboard', label: 'Dashboard', icon: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z' },
    { href: '/workouts', label: 'Training', icon: 'M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11' },
    { href: '/nutrition', label: 'Essen', icon: 'M7 3v8a2 2 0 0 0 2 2v8M11 3v8a2 2 0 0 1-2 2M17 3c-2 2-3 5-3 8h3v10' },
    { href: '/body', label: 'Körper', icon: 'M3 12h4l2-6 4 12 2-6h6' },
    { href: '/goals', label: 'Ziele', icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12.01V12' }
  ];
  const active = (h: string) => page.url.pathname === h || page.url.pathname.startsWith(h + '/') ||
    (h === '/workouts' && page.url.pathname.startsWith('/exercises'));
</script>

<div class="mx-auto min-h-screen w-full max-w-[480px] px-4 pb-28 pt-4">
  <header class="mb-4 flex items-center justify-between">
    <a href="/dashboard" class="text-lg font-black tracking-tight">HUB<span class="text-neon" style="text-shadow:0 0 12px rgba(57,255,20,.7)">.</span></a>
    <a href="/settings" aria-label="Einstellungen" class="grid h-10 w-10 place-items-center rounded-full border border-line text-muted {page.url.pathname.startsWith('/settings') ? 'border-neon text-neon' : ''}">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
    </a>
  </header>

  <main>{@render children()}</main>
</div>

<nav class="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur" style="padding-bottom:env(safe-area-inset-bottom)">
  <ul class="mx-auto flex max-w-[480px] justify-between px-2">
    {#each tabs as t}
      {@const on = active(t.href)}
      <li class="flex-1">
        <a href={t.href} class="flex flex-col items-center gap-1 py-2.5 text-[11px] font-extrabold transition-colors {on ? 'text-neon' : 'text-muted'}" aria-current={on ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style={on ? 'filter:drop-shadow(0 0 6px rgba(57,255,20,.8))' : ''}><path d={t.icon} /></svg>
          {t.label}
        </a>
      </li>
    {/each}
  </ul>
</nav>
