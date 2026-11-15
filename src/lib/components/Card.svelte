<script lang="ts">
  import type { Snippet } from 'svelte';
  let { title = '', class: cls = '', children, action }: { title?: string; class?: string; children: Snippet; action?: Snippet } = $props();
</script>

<section class="card {cls}">
  {#if title || action}
    <div class="mb-3 flex items-center justify-between">
      <h2 class="label">{title}</h2>
      {#if action}{@render action()}{/if}
    </div>
  {/if}
  {@render children()}
</section>
