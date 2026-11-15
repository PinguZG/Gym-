<script lang="ts">
  import '../../app.css';
  let { children } = $props();
</script>

<svelte:head><title>HUB</title></svelte:head>
<main class="min-h-dvh flex items-center justify-center px-5 py-10">
  <div class="w-full max-w-sm">{@render children()}</div>
</main>
