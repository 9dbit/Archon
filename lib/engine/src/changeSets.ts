import { desc, eq } from "drizzle-orm";
import {
  approvals,
  canonicalObjects,
  changeSets,
  db,
  projectBriefs,
  projectRules,
  projects,
  projectVersions,
  validationChecks,
} from "@workspace/db";
import {
  applyOperations,
  assertTransition,
  hasBlockingChecks,
  isEditable,
  runValidationGate,
  type ChangeSetOperation,
  type ChangeSetSource,
} from "@workspace/domain";
import { recordAudit } from "./audit";
import { getApprovedSnapshot } from "./projects";

export class EngineError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 409,
  ) {
    super(message);
    this.name = "EngineError";
  }
}

async function loadChangeSet(changeSetId: string) {
  const [cs] = await db
    .select()
    .from(changeSets)
    .where(eq(changeSets.id, changeSetId));
  if (!cs) throw new EngineError("ChangeSet not found", 404);
  return cs;
}

/**
 * Create a Proposed ChangeSet. Never touches authoritative tables —
 * proposed operations live only inside the change_sets row until commit.
 */
export async function proposeChangeSet(input: {
  projectId: string;
  source: ChangeSetSource;
  intentSummary: string;
  operations: ChangeSetOperation[];
  affectedDomains: string[];
  requestedLocks?: string[];
  createdBy: string;
}) {
  const baseline = await getApprovedSnapshot(input.projectId);
  assertTransition("DRAFT", "PROPOSED");
  const [cs] = await db
    .insert(changeSets)
    .values({
      projectId: input.projectId,
      baseVersionId: baseline.versionId,
      source: input.source,
      intentSummary: input.intentSummary,
      operations: input.operations,
      affectedDomains: input.affectedDomains,
      requestedLocks: input.requestedLocks ?? [],
      createdBy: input.createdBy,
      state: "PROPOSED",
    })
    .returning();
  if (!cs) throw new EngineError("Failed to create ChangeSet", 500);
  await recordAudit(db, {
    projectId: input.projectId,
    entityType: "change_set",
    entityId: cs.id,
    eventType: "CHANGE_SET_PROPOSED",
    actor: input.createdBy,
    payload: { intentSummary: input.intentSummary, source: input.source },
  });
  return cs;
}

/** Edit operations while the ChangeSet is editable; resubmits to PROPOSED. */
export async function updateChangeSetOperations(input: {
  changeSetId: string;
  operations: ChangeSetOperation[];
  intentSummary?: string;
  affectedDomains?: string[];
  actor: string;
}) {
  const cs = await loadChangeSet(input.changeSetId);
  if (!isEditable(cs.state) && cs.state !== "PROPOSED") {
    throw new EngineError(`ChangeSet in state ${cs.state} cannot be edited`);
  }
  const nextState =
    cs.state === "PROPOSED"
      ? "PROPOSED"
      : assertTransition(cs.state, "PROPOSED");
  const [updated] = await db
    .update(changeSets)
    .set({
      operations: input.operations,
      intentSummary: input.intentSummary ?? cs.intentSummary,
      affectedDomains: input.affectedDomains ?? cs.affectedDomains,
      state: nextState,
      updatedAt: new Date(),
    })
    .where(eq(changeSets.id, cs.id))
    .returning();
  await recordAudit(db, {
    projectId: cs.projectId,
    entityType: "change_set",
    entityId: cs.id,
    eventType: "CHANGE_SET_EDITED",
    actor: input.actor,
  });
  return updated!;
}

/** Sandbox preview: before/after computed purely, baseline untouched. */
export async function previewChangeSet(changeSetId: string) {
  const cs = await loadChangeSet(changeSetId);
  const baseline = await getApprovedSnapshot(cs.projectId);
  const after = applyOperations(baseline.snapshot, cs.operations);
  return {
    changeSet: cs,
    baseVersionId: baseline.versionId,
    baseVersionNumber: baseline.versionNumber,
    before: baseline.snapshot,
    after,
    affectedDomains: cs.affectedDomains,
  };
}

/**
 * Run the deterministic Validation Gate against the sandboxed snapshot.
 * PROPOSED -> SANDBOXED -> VALIDATING -> NEEDS_REVIEW | VALIDATION_FAILED.
 */
export async function validateChangeSet(changeSetId: string, actor: string) {
  let cs = await loadChangeSet(changeSetId);
  if (cs.state === "NEEDS_REVIEW" || cs.state === "VALIDATION_FAILED") {
    // Re-validation loop: route back through PROPOSED.
    await db
      .update(changeSets)
      .set({
        state: assertTransition(cs.state, "PROPOSED"),
        updatedAt: new Date(),
      })
      .where(eq(changeSets.id, cs.id));
    cs = await loadChangeSet(changeSetId);
  }
  if (cs.state !== "PROPOSED") {
    throw new EngineError(`ChangeSet in state ${cs.state} cannot be validated`);
  }
  assertTransition(cs.state, "SANDBOXED");
  assertTransition("SANDBOXED", "VALIDATING");

  const baseline = await getApprovedSnapshot(cs.projectId);
  const sandboxed = applyOperations(baseline.snapshot, cs.operations);
  const checks = runValidationGate(sandboxed);
  const finalState = hasBlockingChecks(checks)
    ? assertTransition("VALIDATING", "VALIDATION_FAILED")
    : assertTransition("VALIDATING", "NEEDS_REVIEW");

  await db.transaction(async (tx) => {
    await tx
      .delete(validationChecks)
      .where(eq(validationChecks.changeSetId, cs.id));
    if (checks.length) {
      await tx.insert(validationChecks).values(
        checks.map((c) => ({
          changeSetId: cs.id,
          category: c.category,
          status: c.status,
          severity: c.severity,
          observedValue: c.observedValue,
          expectedValue: c.expectedValue,
          unit: c.unit,
          sourceType: c.sourceType,
          sourceReference: c.sourceReference,
          evidence: c.evidence,
          recommendation: c.recommendation,
          confidence: c.confidence,
        })),
      );
    }
    await tx
      .update(changeSets)
      .set({ state: finalState, updatedAt: new Date() })
      .where(eq(changeSets.id, cs.id));
    await recordAudit(tx, {
      projectId: cs.projectId,
      entityType: "change_set",
      entityId: cs.id,
      eventType: "CHANGE_SET_VALIDATED",
      actor,
      payload: {
        result: finalState,
        checkCount: checks.length,
        blocking: hasBlockingChecks(checks),
      },
    });
  });
  return { state: finalState, checks };
}

export async function listChecks(changeSetId: string) {
  return db
    .select()
    .from(validationChecks)
    .where(eq(validationChecks.changeSetId, changeSetId));
}

export async function annotateCheck(input: {
  checkId: string;
  reviewerNote?: string;
  waiverReason?: string;
  actor: string;
}) {
  const [check] = await db
    .select()
    .from(validationChecks)
    .where(eq(validationChecks.id, input.checkId));
  if (!check) throw new EngineError("Validation check not found", 404);
  const [updated] = await db
    .update(validationChecks)
    .set({
      reviewerNote: input.reviewerNote ?? check.reviewerNote,
      waiverReason: input.waiverReason ?? check.waiverReason,
    })
    .where(eq(validationChecks.id, input.checkId))
    .returning();
  const [cs] = await db
    .select()
    .from(changeSets)
    .where(eq(changeSets.id, check.changeSetId));
  if (cs) {
    await recordAudit(db, {
      projectId: cs.projectId,
      entityType: "validation_check",
      entityId: check.id,
      eventType: "CHECK_ANNOTATED",
      actor: input.actor,
    });
  }
  return updated!;
}

/** Approval — blocked while BLOCKER/CRITICAL checks exist. */
export async function approveChangeSet(input: {
  changeSetId: string;
  reviewer: string;
  note?: string;
}) {
  const cs = await loadChangeSet(input.changeSetId);
  if (cs.state !== "NEEDS_REVIEW") {
    throw new EngineError(`ChangeSet in state ${cs.state} cannot be approved`);
  }
  const checks = await listChecks(cs.id);
  if (hasBlockingChecks(checks)) {
    throw new EngineError(
      "Approval blocked: BLOCKER/CRITICAL validation checks are present. Correct the proposal and re-run validation.",
    );
  }
  const next = assertTransition(cs.state, "APPROVED");
  await db.transaction(async (tx) => {
    await tx
      .update(changeSets)
      .set({ state: next, updatedAt: new Date() })
      .where(eq(changeSets.id, cs.id));
    await tx.insert(approvals).values({
      changeSetId: cs.id,
      decision: "APPROVED",
      reviewer: input.reviewer,
      note: input.note ?? null,
    });
    await recordAudit(tx, {
      projectId: cs.projectId,
      entityType: "change_set",
      entityId: cs.id,
      eventType: "CHANGE_SET_APPROVED",
      actor: input.reviewer,
    });
  });
  return commitChangeSet(cs.id, input.reviewer);
}

export async function rejectChangeSet(input: {
  changeSetId: string;
  reviewer: string;
  note?: string;
}) {
  const cs = await loadChangeSet(input.changeSetId);
  const next = assertTransition(cs.state, "REJECTED");
  await db.transaction(async (tx) => {
    await tx
      .update(changeSets)
      .set({ state: next, updatedAt: new Date() })
      .where(eq(changeSets.id, cs.id));
    await tx.insert(approvals).values({
      changeSetId: cs.id,
      decision: "REJECTED",
      reviewer: input.reviewer,
      note: input.note ?? null,
    });
    await recordAudit(tx, {
      projectId: cs.projectId,
      entityType: "change_set",
      entityId: cs.id,
      eventType: "CHANGE_SET_REJECTED",
      actor: input.reviewer,
    });
  });
  return loadChangeSet(cs.id);
}

/**
 * Transactional, idempotent commit. Creates the immutable ProjectVersion,
 * applies operations to authoritative tables, moves the baseline pointer,
 * and appends audit events — all inside one transaction.
 */
export async function commitChangeSet(changeSetId: string, actor: string) {
  const cs = await loadChangeSet(changeSetId);
  if (cs.state === "COMMITTED") {
    // Idempotent: return the already-created version.
    const [existing] = await db
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.approvedChangeSetId, cs.id));
    return { changeSet: cs, version: existing ?? null };
  }
  if (cs.state !== "APPROVED") {
    throw new EngineError(`ChangeSet in state ${cs.state} cannot be committed`);
  }
  assertTransition(cs.state, "COMMITTING");
  assertTransition("COMMITTING", "COMMITTED");

  const baseline = await getApprovedSnapshot(cs.projectId);
  const after = applyOperations(baseline.snapshot, cs.operations);

  const version = await db.transaction(async (tx) => {
    // Idempotency guard inside the transaction (unique approvedChangeSetId).
    const [already] = await tx
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.approvedChangeSetId, cs.id));
    if (already) return already;

    const [latest] = await tx
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.projectId, cs.projectId))
      .orderBy(desc(projectVersions.versionNumber))
      .limit(1);
    const versionNumber = (latest?.versionNumber ?? 0) + 1;

    const [created] = await tx
      .insert(projectVersions)
      .values({
        projectId: cs.projectId,
        versionNumber,
        parentVersionId: baseline.versionId,
        snapshot: after,
        approvedChangeSetId: cs.id,
      })
      .returning();
    if (!created) throw new EngineError("Failed to create version", 500);

    // Apply operations to authoritative tables.
    if (after.brief) {
      await tx
        .insert(projectBriefs)
        .values({ projectId: cs.projectId, brief: after.brief })
        .onConflictDoUpdate({
          target: projectBriefs.projectId,
          set: { brief: after.brief, updatedAt: new Date() },
        });
    }
    await tx
      .delete(projectRules)
      .where(eq(projectRules.projectId, cs.projectId));
    if (after.rules.length) {
      await tx.insert(projectRules).values(
        after.rules.map((r) => ({
          projectId: cs.projectId,
          code: r.code,
          category: r.category,
          description: r.description,
          subject: r.subject,
          operator: r.operator,
          expectedValue: r.expectedValue,
          unit: r.unit,
          sourceType: r.sourceType,
          sourceReference: r.sourceReference ?? null,
          severity: r.severity,
          active: r.active,
        })),
      );
    }
    await tx
      .delete(canonicalObjects)
      .where(eq(canonicalObjects.projectId, cs.projectId));
    if (after.canonicalObjects.length) {
      await tx.insert(canonicalObjects).values(
        after.canonicalObjects.map((o) => ({
          archonId: o.archonId,
          projectId: cs.projectId,
          objectType: o.objectType,
          parameters: o.parameters,
          relationships: o.relationships,
          provenance: o.provenance,
          confidence: o.confidence ?? null,
        })),
      );
    }

    await tx
      .update(projects)
      .set({ currentApprovedVersionId: created.id, updatedAt: new Date() })
      .where(eq(projects.id, cs.projectId));
    await tx
      .update(changeSets)
      .set({ state: "COMMITTED", updatedAt: new Date() })
      .where(eq(changeSets.id, cs.id));
    await recordAudit(tx, {
      projectId: cs.projectId,
      entityType: "project_version",
      entityId: created.id,
      eventType: "VERSION_COMMITTED",
      actor,
      payload: { versionNumber, changeSetId: cs.id },
    });
    return created;
  });

  return { changeSet: await loadChangeSet(cs.id), version };
}

export async function listChangeSets(projectId: string) {
  return db
    .select()
    .from(changeSets)
    .where(eq(changeSets.projectId, projectId))
    .orderBy(desc(changeSets.createdAt));
}

export async function getChangeSet(changeSetId: string) {
  return loadChangeSet(changeSetId);
}
