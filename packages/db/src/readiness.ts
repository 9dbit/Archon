import postgres from 'postgres';

/**
 * A side-effect-free DB readiness probe for the independent Render database.
 * Creates and closes one lightweight connection instead of retaining a pool.
 */
export async function checkArchonDatabaseReadiness(databaseUrl: string): Promise<boolean> {
  const client = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 3 });
  try {
    const result = await client`SELECT 1 AS ready`;
    return result[0]?.ready === 1;
  } catch {
    return false;
  } finally {
    await client.end();
  }
}
