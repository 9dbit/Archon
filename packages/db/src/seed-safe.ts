import { eq } from 'drizzle-orm';
import { createDatabase } from './index';
import { projects } from './schema';
import { seedCasaNusa } from './seed';

export async function seedCasaNusaOnce(databaseUrl: string) {
  const db = createDatabase(databaseUrl);
  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.name, 'Casa Nusa Restaurant'))
    .limit(1);

  if (existing) {
    console.log(`[ARCHON DB] Casa Nusa seed already exists: ${existing.id}`);
    return { projectId: existing.id, seeded: false };
  }

  const result = await seedCasaNusa(databaseUrl);
  return { ...result, seeded: true };
}

if (process.argv[1]?.endsWith('seed-safe.ts')) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  seedCasaNusaOnce(databaseUrl)
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error('[ARCHON DB] seed failed', error);
      process.exit(1);
    });
}
