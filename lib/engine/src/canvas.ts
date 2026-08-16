import { desc, eq } from "drizzle-orm";
import { canvasArtifacts, db } from "@workspace/db";
import type {
  CanvasArtifactInput,
  ChangeSetOperation,
} from "@workspace/domain";
import { recordAudit } from "./audit";
import { EngineError, proposeChangeSet } from "./changeSets";

/**
 * Canvas artifacts are permanently non-authoritative (replit.md rule 2).
 * The only path toward authoritative state is promotion, which creates a
 * Proposed ChangeSet — never a direct canonical mutation.
 */

export async function createCanvasArtifact(input: {
  projectId: string;
  artifact: CanvasArtifactInput;
  actor: string;
}) {
  const [artifact] = await db
    .insert(canvasArtifacts)
    .values({
      projectId: input.projectId,
      artifactType: input.artifact.artifactType,
      title: input.artifact.title,
      status: input.artifact.status,
      authoritative: false, // invariant — no write path may set this true
      parentArtifactIds: input.artifact.parentArtifactIds,
      sourceType: input.artifact.sourceType,
      sourceReference: input.artifact.sourceReference ?? null,
      metadata: input.artifact.metadata,
    })
    .returning();
  if (!artifact) throw new EngineError("Failed to create canvas artifact", 500);
  await recordAudit(db, {
    projectId: input.projectId,
    entityType: "canvas_artifact",
    entityId: artifact.id,
    eventType: "CANVAS_ARTIFACT_CREATED",
    actor: input.actor,
    payload: { title: artifact.title },
  });
  return artifact;
}

export async function listCanvasArtifacts(projectId: string) {
  return db
    .select()
    .from(canvasArtifacts)
    .where(eq(canvasArtifacts.projectId, projectId))
    .orderBy(desc(canvasArtifacts.createdAt));
}

/**
 * Promotion placeholder: produces a Proposed ChangeSet carrying the supplied
 * operations. It does NOT mutate any authoritative table.
 */
export async function promoteCanvasArtifact(input: {
  artifactId: string;
  operations: ChangeSetOperation[];
  intentSummary?: string;
  affectedDomains?: string[];
  actor: string;
}) {
  const [artifact] = await db
    .select()
    .from(canvasArtifacts)
    .where(eq(canvasArtifacts.id, input.artifactId));
  if (!artifact) throw new EngineError("Canvas artifact not found", 404);

  const changeSet = await proposeChangeSet({
    projectId: artifact.projectId,
    source: "CANVAS_PROMOTION",
    intentSummary:
      input.intentSummary ?? `Promote canvas artifact "${artifact.title}"`,
    operations: input.operations,
    affectedDomains: input.affectedDomains ?? ["layout"],
    createdBy: input.actor,
  });

  const [updated] = await db
    .update(canvasArtifacts)
    .set({
      promotionStatus: "PROMOTION_PROPOSED",
      promotionChangeSetId: changeSet.id,
    })
    .where(eq(canvasArtifacts.id, artifact.id))
    .returning();
  await recordAudit(db, {
    projectId: artifact.projectId,
    entityType: "canvas_artifact",
    entityId: artifact.id,
    eventType: "CANVAS_ARTIFACT_PROMOTION_PROPOSED",
    actor: input.actor,
    payload: { changeSetId: changeSet.id },
  });
  return { artifact: updated!, changeSet };
}
