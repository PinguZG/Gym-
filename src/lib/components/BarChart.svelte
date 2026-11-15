<script lang="ts">
  import { clamp } from './format';
  let { items = [], max = 0, unit = '' }: { items: { label: string; value: number }[]; max?: number; unit?: string } = $props();
  const m = $derived(max || Math.max(1, ...items.map((i) => i.value)));
</script>

<ul class="space-y-2">
  {#each items as it}
    <li class="flex items-center gap-3 text-sm">
      <span class="w-24 shrink-0 truncate text-muted">{it.label}</span>
      <div class="h-2.5 flex-1 overflow-hidden rounded-full bg-card-2">
        <div class="h-full rounded-full bg-neon" style="width:{clamp(it.value / m) * 100}%; box-shadow:0 0 10px rgba(57,255,20,.55)"></div>
      </div>
      <span class="w-10 shrink-0 text-right tabular-nums">{new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(it.value)}{unit}</span>
    </li>
  {/each}
</ul>
