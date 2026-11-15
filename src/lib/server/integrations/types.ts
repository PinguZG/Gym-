import type { IntegrationMode, ProviderId, SyncResult } from '../../types';

export interface IntegrationAdapter {
  id: ProviderId;
  label: string;
  capabilities: string[];
  /** Einzeilige Risikoeinschätzung (Stand der inoffiziellen Lib) für die UI */
  risk: string;
  /** Aus env INTEGRATION_<ID>; Default 'off' */
  mode(): IntegrationMode;
  sync(ctx: { userId: string; since: number }): Promise<SyncResult>;
  /** Push-basierte Quellen (Apple Health Auto Export) */
  ingest?(payload: unknown, userId: string): Promise<{ items: number }>;
}

export function envMode(id: ProviderId): IntegrationMode {
  const v = (process.env[`INTEGRATION_${id.toUpperCase()}`] ?? 'off').trim().toLowerCase();
  return v === 'mock' || v === 'live' ? v : 'off';
}

export const emptyResult = (): SyncResult => ({ workouts: [], nutrition: [], body: [] });
