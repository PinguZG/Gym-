<script lang="ts">
  import { clamp } from './format';
  let { value = 0, max = 1, label = '', right = '', height = 'h-2.5' }: { value?: number; max?: number; label?: string; right?: string; height?: string } = $props();
  const pct = $derived(max > 0 ? clamp(value / max) * 100 : 0);
</script>

<div>
  {#if label || right}
    <div class="mb-1.5 flex justify-between text-sm"><span>{label}</span><span class="text-muted">{right}</span></div>
  {/if}
  <div class="w-full overflow-hidden rounded-full bg-card-2 {height}" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin="0" aria-valuemax="100">
    <div class="h-full rounded-full bg-neon transition-all" style="width:{pct}%; box-shadow:0 0 12px rgba(57,255,20,.6)"></div>
  </div>
</div>
