import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const MIGRATION_ID = '0000_archon_foundation';

export async function migrate(databaseUrl: string) {
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS archon_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());`);
    const [existing] = await sql<{ id: string }[]>`SELECT id FROM archon_migrations WHERE id = ${MIGRATION_ID} LIMIT 1`;
    if (existing) return;
    const migrationPath = fileURLToPath(new URL('../drizzle/0000_archon_foundation.sql', import.meta.url));
    const migrationSql = await readFile(migrationPath, 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(migrationSql);
      await tx`INSERT INTO archon_migrations (id) VALUES (${MIGRATION_ID}) ON CONFLICT (id) DO NOTHING`;
    });
    console.log(`[ARCHON DB] applied ${MIGRATION_ID}`);
  } finally {
    await sql.end();
  }
}

if (process.argv[1]?.endsWith('migrate.ts')) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  migrate(databaseUrl).catch((error) => {
    console.error('[ARCHON DB] migration failed', error);
    process.exit(1);
  });
}
