<script lang="ts">
  import { dateShort } from './format';
  type Series = { name: string; color?: string; points: { x: string; y: number | null }[] };
  let { series = [], unit = '', height = 160, uid = 'lc' }: { series: Series[]; unit?: string; height?: number; uid?: string } = $props();
  const W = 320, padL = 34, padR = 8, padT = 10, padB = 20;
  const colors = ['#39ff14', '#7fb3ff'];
  const all = $derived(series.flatMap((s) => s.points.filter((p) => p.y != null).map((p) => p.y as number)));
  const xs = $derived([...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort());
  const lo = $derived(all.length ? Math.min(...all) : 0);
  const hi = $derived(all.length ? Math.max(...all) : 1);
  const span = $derived(hi - lo || 1);
  const yMin = $derived(lo - span * 0.1);
  const yMax = $derived(hi + span * 0.1);
  const X = (x: string) => padL + (xs.length > 1 ? xs.indexOf(x) / (xs.length - 1) : 0.5) * (W - padL - padR);
  const Y = (y: number) => padT + (1 - (y - yMin) / (yMax - yMin)) * (height - padT - padB);
  const path = (s: Series) =>
    s.points.filter((p) => p.y != null).map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y as number).toFixed(1)}`).join(' ');
  const fmt = (v: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: span < 10 ? 1 : 0 }).format(v);
  const ticks = $derived([yMin + (yMax - yMin) * 0.1, (yMin + yMax) / 2, yMax - (yMax - yMin) * 0.1]);
</script>

{#if all.length === 0}
  <p class="py-6 text-center text-sm text-muted">Noch keine Daten.</p>
{:else}
  <svg viewBox="0 0 {W} {height}" class="w-full" role="img" aria-label="Verlaufschart">
    <defs>
      <filter id="glow-{uid}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    {#each ticks as t}
      <line x1={padL} x2={W - padR} y1={Y(t)} y2={Y(t)} stroke="#232a23" stroke-dasharray="3 4" />
      <text x={padL - 5} y={Y(t) + 3} text-anchor="end" font-size="9" fill="#8a958a">{fmt(t)}</text>
    {/each}
    {#if xs.length}
      <text x={padL} y={height - 5} font-size="9" fill="#8a958a">{dateShort(xs[0])}</text>
      <text x={W - padR} y={height - 5} text-anchor="end" font-size="9" fill="#8a958a">{dateShort(xs[xs.length - 1])}</text>
    {/if}
    {#each series as s, i}
      {@const col = s.color ?? colors[i % colors.length]}
      <path d={path(s)} fill="none" stroke={col} stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow-{uid})" />
      {#each s.points.filter((p) => p.y != null) as p}
        {#if xs.length < 25}<circle cx={X(p.x)} cy={Y(p.y as number)} r="2.5" fill={col} />{/if}
      {/each}
    {/each}
  </svg>
  {#if series.length > 1}
    <div class="mt-1 flex gap-4 text-xs text-muted">
      {#each series as s, i}<span class="flex items-center gap-1.5"><i class="inline-block h-2 w-2 rounded-full" style="background:{s.color ?? colors[i % colors.length]}"></i>{s.name}</span>{/each}
      {#if unit}<span class="ml-auto">{unit}</span>{/if}
    </div>
  {/if}
{/if}
