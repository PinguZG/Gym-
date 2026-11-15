<script lang="ts">
  let { label, value, sub = '', accent = false }: { label: string; value: string; sub?: string; accent?: boolean } = $props();
</script>

<div class="rounded-2xl border border-line bg-card-2 p-3">
  <div class="label">{label}</div>
  <div class="big mt-1.5 whitespace-nowrap !text-[1.55rem] {accent ? 'text-neon' : ''}" style={accent ? 'text-shadow:0 0 14px rgba(57,255,20,.5)' : ''}>{value}</div>
  {#if sub}<div class="mt-1 text-xs text-muted">{sub}</div>{/if}
</div>
