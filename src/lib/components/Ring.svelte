<script lang="ts">
  import { clamp } from './format';
  let { value = 0, max = 1, label = '', text = '', size = 92 }: { value?: number; max?: number; label?: string; text?: string; size?: number } = $props();
  const r = 40;
  const c = 2 * Math.PI * r;
  const ratio = $derived(max > 0 ? clamp(value / max) : 0);
</script>

<div class="flex flex-col items-center">
  <div class="relative" style="width:{size}px;height:{size}px">
    <svg viewBox="0 0 100 100" width={size} height={size} class="-rotate-90">
      <circle cx="50" cy="50" {r} fill="none" stroke="#161b16" stroke-width="10" />
      <circle cx="50" cy="50" {r} fill="none" stroke="#39ff14" stroke-width="10" stroke-linecap="round"
        stroke-dasharray={c} stroke-dashoffset={c * (1 - ratio)} style="filter:drop-shadow(0 0 4px rgba(57,255,20,.7))" />
    </svg>
    <div class="absolute inset-0 grid place-items-center text-sm font-black tabular-nums">{text}</div>
  </div>
  {#if label}<div class="label mt-1.5">{label}</div>{/if}
</div>
