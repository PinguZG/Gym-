<script lang="ts">
  let { message = '', onclose }: { message?: string; onclose?: () => void } = $props();
  $effect(() => {
    if (!message) return;
    const t = setTimeout(() => onclose?.(), 4500);
    return () => clearTimeout(t);
  });
</script>

{#if message}
  <div class="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4" role="status">
    <div class="glow pointer-events-auto max-w-[440px] rounded-full border border-neon bg-card px-5 py-3 text-sm font-extrabold text-neon">{message}</div>
  </div>
{/if}
