const nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
export const n0 = (v: number | null | undefined) => (v == null ? '–' : nf0.format(v));
export const n1 = (v: number | null | undefined) => (v == null ? '–' : nf1.format(v));
export const n2 = (v: number | null | undefined) => (v == null ? '–' : nf2.format(v));
export const dateShort = (d: string | number) =>
  new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' }).format(
    typeof d === 'string' ? new Date(d + 'T12:00:00') : new Date(d)
  );
export const dateLong = (ms: number) =>
  new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date(ms));
export const todayBerlin = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
