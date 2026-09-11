import { createDatabase } from '@archon/db';

let db: ReturnType<typeof createDatabase> | null = null;

export function getDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_NOT_CONFIGURED');
  db ??= createDatabase(url);
  return db;
}
