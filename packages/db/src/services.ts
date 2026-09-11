import { and, desc, eq, max } from 'drizzle-orm';
import type { ArchonDatabase } from './index';
import {
  approvals,
  auditEvents,
  changeSets,
  projectVersions,
  projects,
  validationFindings
} from './schema';

export async function getProjectSummary(db: ArchonDatabase, projectId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return null;

  const versions = await db
    .select()
    .from(projectVersions)
    .where(eq(projectVersions.projectId, projectId))
    .orderBy(desc(projectVersions.versionNumber));

  const proposedChanges = await db
    .select()
    .from(changeSets)
    .where(eq(changeSets.projectId, projectId))
    .orderBy(desc(changeSets.createdAt));

  return { project, versions, proposedChanges };
}

export async function approveChangeSet(
  db: ArchonDatabase,
  input: { changeSetId: string; reviewer: string; note?: string }
) {
  return db.transaction(async (tx) => {
    const [changeSet] = await tx
      .select()
      .from(changeSets)
      .where(eq(changeSets.id, input.changeSetId))
      .limit(1);

    if (!changeSet) throw new Error('CHANGESET_NOT_FOUND');
    if (!['NEEDS_REVIEW', 'APPROVED', 'COMMITTED'].includes(changeSet.state)) {
      throw new Error(`CHANGESET_NOT_APPROVABLE:${changeSet.state}`);
    }

    const blockers = await tx
      .select()
      .from(validationFindings)
      .where(
        and(
          eq(validationFindings.changeSetId, changeSet.id),
          // Drizzle does not expose an IN helper through eq; filtering below preserves strict typing.
        )
      );

    if (blockers.some((finding) => finding.status === 'BLOCKER' || finding.status === 'CRITICAL')) {
      throw new Error('VALIDATION_BLOCKS_APPROVAL');
    }

    const [existingVersion] = await tx
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.approvedChangeSetId, changeSet.id))
      .limit(1);

    if (existingVersion) return existingVersion;

    await tx.insert(approvals).values({
      changeSetId: changeSet.id,
      decision: 'APPROVED',
      reviewer: input.reviewer,
      note: input.note
    });

    await tx
      .update(changeSets)
      .set({ state: 'COMMITTING', updatedAt: new Date() })
      .where(eq(changeSets.id, changeSet.id));

    const [latest] = await tx
      .select({ versionNumber: max(projectVersions.versionNumber) })
      .from(projectVersions)
      .where(eq(projectVersions.projectId, changeSet.projectId));

    const nextVersionNumber = (latest?.versionNumber ?? 0) + 1;
    const snapshot = {
      schemaVersion: 1,
      projectId: changeSet.projectId,
      baseVersionId: changeSet.baseVersionId,
      committedChangeSet: {
        id: changeSet.id,
        intentSummary: changeSet.intentSummary,
        operations: changeSet.operations,
        affectedDomains: changeSet.affectedDomains,
        requestedLocks: changeSet.requestedLocks
      }
    };

    const [version] = await tx
      .insert(projectVersions)
      .values({
        projectId: changeSet.projectId,
        versionNumber: nextVersionNumber,
        parentVersionId: changeSet.baseVersionId,
        snapshot,
        approvedChangeSetId: changeSet.id
      })
      .returning();

    await tx
      .update(changeSets)
      .set({ state: 'COMMITTED', updatedAt: new Date() })
      .where(eq(changeSets.id, changeSet.id));

    await tx
      .update(projects)
      .set({ currentApprovedVersionId: version.id, updatedAt: new Date() })
      .where(eq(projects.id, changeSet.projectId));

    await tx.insert(auditEvents).values([
      {
        projectId: changeSet.projectId,
        entityType: 'ChangeSet',
        entityId: changeSet.id,
        eventType: 'APPROVED_AND_COMMITTED',
        actor: input.reviewer,
        payload: { versionId: version.id, versionNumber: version.versionNumber }
      },
      {
        projectId: changeSet.projectId,
        entityType: 'ProjectVersion',
        entityId: version.id,
        eventType: 'CREATED',
        actor: input.reviewer,
        payload: { changeSetId: changeSet.id }
      }
    ]);

    return version;
  });
}
