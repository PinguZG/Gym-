<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

<svelte:head>
  <title>Hub – Training & Ernährung</title>
  <meta name="theme-color" content="#070907" />
</svelte:head>

{@render children()}
