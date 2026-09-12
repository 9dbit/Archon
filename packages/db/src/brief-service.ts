import { eq } from 'drizzle-orm';
import type { ArchonDatabase } from './index';
import { projectBriefs } from './schema';

export async function getProjectBrief(db: ArchonDatabase, projectId: string) {
  const [brief] = await db
    .select()
    .from(projectBriefs)
    .where(eq(projectBriefs.projectId, projectId))
    .limit(1);

  return brief ?? null;
}
