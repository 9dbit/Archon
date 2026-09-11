import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL is not set. Drizzle commands that require a database connection will fail.');
}

export default defineConfig({
  schema: './packages/db/src/schema.ts',
  out: './packages/db/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://archon:archon@localhost:5432/archon'
  },
  strict: true,
  verbose: true
});
