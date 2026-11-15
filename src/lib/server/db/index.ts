import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

const url = process.env.DATABASE_URL ?? './data/hub.db';
mkdirSync(dirname(url), { recursive: true });
const sqlite = new Database(url);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
migrate(db, { migrationsFolder: process.env.MIGRATIONS_DIR ?? './drizzle' });
export { schema, sqlite };
