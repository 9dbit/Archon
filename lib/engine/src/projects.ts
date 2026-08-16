import { desc, eq } from "drizzle-orm";
import {
  auditEvents,
  canonicalObjects,
  db,
  projectBriefs,
  projectRules,
  projects,
  projectVersions,
} from "@workspace/db";
import type { CanonicalSnapshot } from "@workspace/domain";
import { emptySnapshot } from "@workspace/domain";
import { recordAudit } from "./audit";

export async function createProject(input: {
  name: string;
  buildingType: string;
  locationText?: string;
  actor: string;
}) {
  const [project] = await db
    .insert(projects)
    .values({
      name: input.name,
      buildingType: input.buildingType,
      locationText: input.locationText ?? null,
    })
    .returning();
  if (!project) throw new Error("Failed to create project");
  await recordAudit(db, {
    projectId: project.id,
    entityType: "project",
    entityId: project.id,
    eventType: "PROJECT_CREATED",
    actor: input.actor,
    payload: { name: input.name },
  });
  return project;
}

export async function listProjects() {
  return db.select().from(projects).orderBy(desc(projects.createdAt));
}

export async function getProject(projectId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));
  return project ?? null;
}

/** Authoritative approved baseline — the snapshot of the current approved version. */
export async function getApprovedSnapshot(projectId: string): Promise<{
  snapshot: CanonicalSnapshot;
  versionId: string | null;
  versionNumber: number;
}> {
  const project = await getProject(projectId);
  if (!project) throw new Error("Project not found");
  if (!project.currentApprovedVersionId) {
    return { snapshot: emptySnapshot(), versionId: null, versionNumber: 0 };
  }
  const [version] = await db
    .select()
    .from(projectVersions)
    .where(eq(projectVersions.id, project.currentApprovedVersionId));
  if (!version) {
    return { snapshot: emptySnapshot(), versionId: null, versionNumber: 0 };
  }
  return {
    snapshot: version.snapshot,
    versionId: version.id,
    versionNumber: version.versionNumber,
  };
}

export async function getProjectDetail(projectId: string) {
  const project = await getProject(projectId);
  if (!project) return null;
  const [brief] = await db
    .select()
    .from(projectBriefs)
    .where(eq(projectBriefs.projectId, projectId));
  const rules = await db
    .select()
    .from(projectRules)
    .where(eq(projectRules.projectId, projectId));
  const objects = await db
    .select()
    .from(canonicalObjects)
    .where(eq(canonicalObjects.projectId, projectId));
  const approved = await getApprovedSnapshot(projectId);
  return {
    project,
    brief: brief ?? null,
    rules,
    canonicalObjects: objects,
    approved,
  };
}

export async function listVersions(projectId: string) {
  return db
    .select()
    .from(projectVersions)
    .where(eq(projectVersions.projectId, projectId))
    .orderBy(desc(projectVersions.versionNumber));
}

export async function listAuditEvents(projectId: string) {
  return db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.projectId, projectId))
    .orderBy(desc(auditEvents.createdAt));
}
