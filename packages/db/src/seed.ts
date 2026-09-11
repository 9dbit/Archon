import { createDatabase } from './index';
import {
  auditEvents,
  canvasArtifacts,
  changeSets,
  projectBriefs,
  projects,
  projectVersions,
  validationFindings
} from './schema';

export async function seedCasaNusa(databaseUrl: string) {
  const db = createDatabase(databaseUrl);

  const [project] = await db.insert(projects).values({
    name: 'Casa Nusa Restaurant',
    status: 'ACTIVE',
    buildingType: 'Restaurant',
    locationText: 'Bali, Indonesia'
  }).returning();

  await db.insert(projectBriefs).values({
    projectId: project.id,
    siteWidthMm: 24800,
    siteDepthMm: 15000,
    levels: 2,
    floorToFloorHeights: [4000, 4000],
    programRequirements: {
      diningCapacity: 120,
      kitchenTargetPercent: 28,
      vipRooms: 2,
      serviceCirculationMinMm: 1200
    },
    notes: 'Deterministic ARCHON production seed for UI and governance testing.'
  });

  await db.insert(canvasArtifacts).values({
    projectId: project.id,
    title: 'Dining Concept A',
    artifactType: 'AI_CONCEPT',
    authority: 'CANVAS',
    promotionStatus: 'CANDIDATE',
    metadata: { style: 'tropical contemporary', designLockProfile: 'layout-locked' }
  });

  const [bootstrapChangeSet] = await db.insert(changeSets).values({
    projectId: project.id,
    intentSummary: 'Establish approved baseline for Casa Nusa Restaurant',
    operations: [],
    affectedDomains: ['brief', 'layout'],
    requestedLocks: ['structure', 'layout'],
    createdBy: 'ARCHON Seed',
    state: 'COMMITTED'
  }).returning();

  const [version] = await db.insert(projectVersions).values({
    projectId: project.id,
    versionNumber: 1,
    snapshot: {
      schemaVersion: 1,
      brief: { diningCapacity: 120, serviceCirculationMinMm: 1200 },
      canonicalObjects: []
    },
    approvedChangeSetId: bootstrapChangeSet.id
  }).returning();

  await db.update(projects).set({ currentApprovedVersionId: version.id }).where((await import('drizzle-orm')).eq(projects.id, project.id));

  const [pending] = await db.insert(changeSets).values({
    projectId: project.id,
    baseVersionId: version.id,
    intentSummary: 'Widen kitchen to 6,400 mm while preserving structural grid',
    operations: [
      { type: 'MOVE', targetId: 'archon_wall_w014', payload: { deltaXmm: 600 } },
      { type: 'UPDATE', targetId: 'archon_room_kitchen', payload: { widthMm: 6400 } }
    ],
    affectedDomains: ['layout', 'openings', 'furniture'],
    requestedLocks: ['structure'],
    createdBy: 'ARCHON Assistant',
    state: 'NEEDS_REVIEW'
  }).returning();

  await db.insert(validationFindings).values([
    {
      changeSetId: pending.id,
      category: 'geometry',
      status: 'PASS',
      sourceType: 'ARCHON_RULE',
      sourceReference: 'GEOM-INTEGRITY',
      evidence: 'Room boundaries remain closed after wall move.',
      confidencePermille: 1000
    },
    {
      changeSetId: pending.id,
      category: 'circulation',
      status: 'WARNING',
      observedValue: '1540',
      expectedValue: '1500',
      unit: 'mm',
      sourceType: 'PROJECT_RULE',
      sourceReference: 'CIRC-MIN-1500',
      evidence: 'Minimum clear aisle remains above project threshold.',
      recommendation: 'Review furniture clearance around service path.',
      confidencePermille: 980
    }
  ]);

  await db.insert(auditEvents).values({
    projectId: project.id,
    entityType: 'Project',
    entityId: project.id,
    eventType: 'SEEDED',
    actor: 'ARCHON Seed',
    payload: { initialVersionId: version.id, pendingChangeSetId: pending.id }
  });

  return { projectId: project.id, versionId: version.id, pendingChangeSetId: pending.id };
}

if (process.argv[1]?.endsWith('seed.ts')) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  seedCasaNusa(url).then((result) => console.log(JSON.stringify(result, null, 2)));
}
