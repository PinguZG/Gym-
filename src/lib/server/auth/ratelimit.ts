// In-Memory-Rate-Limit. Hinweis: bei mehreren Instanzen (Skalierung) muss das in die DB wandern.
const MAX = 5;
const WINDOW_MS = 15 * 60 * 1000;
const fails = new Map<string, number[]>();

function recent(key: string): number[] {
  const cutoff = Date.now() - WINDOW_MS;
  const list = (fails.get(key) ?? []).filter((t) => t > cutoff);
  if (list.length) fails.set(key, list);
  else fails.delete(key);
  return list;
}

export const loginKey = (ip: string, email: string) => `${ip}|${email}`;
export const isLimited = (key: string) => recent(key).length >= MAX;
export function recordFailure(key: string) {
  const list = recent(key);
  list.push(Date.now());
  fails.set(key, list);
  if (fails.size > 10000) for (const k of fails.keys()) recent(k);
}
export const clearFailures = (key: string) => void fails.delete(key);
