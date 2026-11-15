// Datums-Helper (Zeitzone Europe/Berlin, Woche beginnt Montag)
const TZ = 'Europe/Berlin';
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/** ms UTC -> 'YYYY-MM-DD' in Berlin */
export function dateOf(ms: number): string {
  return fmt.format(new Date(ms));
}

export function today(): string {
  return dateOf(Date.now());
}

function parse(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

/** Montag der Woche */
export function weekStart(date: string): string {
  const dow = (parse(date).getUTCDay() + 6) % 7;
  return addDays(date, -dow);
}

export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** Grober ms-Bereich (mit Puffer) für DB-Vorfilter; exakt danach per dateOf() filtern. */
export function msRange(fromDate: string, toDate: string): [number, number] {
  return [parse(fromDate).getTime() - 26 * 3600e3, parse(toDate).getTime() + 50 * 3600e3];
}

export function inRange(ms: number, from: string, to: string): boolean {
  const d = dateOf(ms);
  return d >= from && d <= to;
}

/** Datum -> ms (Mittag UTC, stabil für Berlin-Tag) */
export function noonMs(date: string): number {
  return parse(date).getTime() + 12 * 3600e3;
}
