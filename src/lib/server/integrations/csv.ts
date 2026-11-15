/** Minimaler CSV-Parser (Trenner , oder ;, Anführungszeichen, Header-Zeile). */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];
  const sep = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const split = (line: string): string[] => {
    const out: string[] = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true;
      else if (c === sep) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const head = split(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((l) => {
    const cells = split(l);
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? '']));
  });
}
/** "12,5" oder "12.5" -> Zahl, sonst NaN */
export const num = (s: string | undefined): number => Number((s ?? '').replace(',', '.'));
