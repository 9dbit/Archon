import { eq } from 'drizzle-orm';
import type { ArchonDatabase } from './index';
import {
  sketchupExecutionPackageApprovals,
  sketchupExecutionPackages
} from './schema';

const SHA256_HEX = /^[a-f0-9]{64}$/;
const FINGERPRINT = /^[a-f0-9]{8,64}$/i;

type DatabaseExecutor = Pick<ArchonDatabase, 'select' | 'insert'>;

export type ApprovedSketchUpExecutionPackageInput = {
  packageHash: string;
  draftFingerprint: string;
  projectRef?: string | null;
  proposedChangeSetId: string;
  drawingIrFingerprint: string;
  payload: Record<string, unknown>;
  approvedBy: string;
  note?: string | null;
  expectedDrawingIrFingerprint: string;
  expectedProposedChangeSetId: string;
};

function requiredText(value: string, code: string, max = 200) {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error(code);
  return normalized;
}

function validateInput(input: ApprovedSketchUpExecutionPackageInput) {
  const packageHash = input.packageHash.trim().toLowerCase();
  if (!SHA256_HEX.test(packageHash)) throw new Error('EXECUTION_PACKAGE_HASH_INVALID');
  if (!FINGERPRINT.test(input.draftFingerprint.trim())) throw new Error('EXECUTION_PACKAGE_DRAFT_FINGERPRINT_INVALID');
  if (!FINGERPRINT.test(input.drawingIrFingerprint.trim())) throw new Error('EXECUTION_PACKAGE_DRAWING_FINGERPRINT_INVALID');
  if (!FINGERPRINT.test(input.expectedDrawingIrFingerprint.trim())) throw new Error('EXECUTION_PACKAGE_EXPECTED_DRAWING_FINGERPRINT_INVALID');

  const proposedChangeSetId = requiredText(input.proposedChangeSetId, 'EXECUTION_PACKAGE_CHANGESET_ID_INVALID');
  const expectedProposedChangeSetId = requiredText(input.expectedProposedChangeSetId, 'EXECUTION_PACKAGE_EXPECTED_CHANGESET_ID_INVALID');
  const approvedBy = requiredText(input.approvedBy, 'EXECUTION_PACKAGE_APPROVER_INVALID', 120);
  const projectRef = typeof input.projectRef === 'string' && input.projectRef.trim()
    ? requiredText(input.projectRef, 'EXECUTION_PACKAGE_PROJECT_REF_INVALID', 160)
    : null;
  const note = typeof input.note === 'string' && input.note.trim()
    ? requiredText(input.note, 'EXECUTION_PACKAGE_NOTE_INVALID', 1000)
    : null;

  if (input.drawingIrFingerprint.trim() !== input.expectedDrawingIrFingerprint.trim()) {
    throw new Error('EXECUTION_PACKAGE_DRAWING_FINGERPRINT_MISMATCH');
  }
  if (proposedChangeSetId !== expectedProposedChangeSetId) {
    throw new Error('EXECUTION_PACKAGE_CHANGESET_ID_MISMATCH');
  }
  if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) {
    throw new Error('EXECUTION_PACKAGE_PAYLOAD_INVALID');
  }

  return {
    packageHash,
    draftFingerprint: input.draftFingerprint.trim().toLowerCase(),
    projectRef,
    proposedChangeSetId,
    drawingIrFingerprint: input.drawingIrFingerprint.trim().toLowerCase(),
    payload: input.payload,
    approvedBy,
    note,
    expectedDrawingIrFingerprint: input.expectedDrawingIrFingerprint.trim().toLowerCase(),
    expectedProposedChangeSetId
  };
}

async function getByHash(db: DatabaseExecutor, packageHash: string) {
  const [record] = await db.select().from(sketchupExecutionPackages)
    .where(eq(sketchupExecutionPackages.packageHash, packageHash)).limit(1);
  return record ?? null;
}

export async function getApprovedSketchUpExecutionPackage(db: ArchonDatabase, packageHash: string) {
  const normalized = packageHash.trim().toLowerCase();
  if (!SHA256_HEX.test(normalized)) throw new Error('EXECUTION_PACKAGE_HASH_INVALID');
  const packageRecord = await getByHash(db, normalized);
  if (!packageRecord) return null;
  const [approval] = await db.select().from(sketchupExecutionPackageApprovals)
    .where(eq(sketchupExecutionPackageApprovals.packageId, packageRecord.id)).limit(1);
  return { package: packageRecord, approval: approval ?? null };
}

export async function approveSketchUpExecutionPackage(
  db: ArchonDatabase,
  input: ApprovedSketchUpExecutionPackageInput
) {
  const normalized = validateInput(input);

  return db.transaction(async tx => {
    const [existingForChangeSet] = await tx.select().from(sketchupExecutionPackages)
      .where(eq(sketchupExecutionPackages.proposedChangeSetId, normalized.proposedChangeSetId)).limit(1);

    if (existingForChangeSet && existingForChangeSet.packageHash !== normalized.packageHash) {
      throw new Error('EXECUTION_PACKAGE_CHANGESET_ALREADY_BOUND');
    }

    let packageRecord = existingForChangeSet ?? null;
    if (!packageRecord) {
      const [created] = await tx.insert(sketchupExecutionPackages).values({
        packageHash: normalized.packageHash,
        draftFingerprint: normalized.draftFingerprint,
        projectRef: normalized.projectRef,
        proposedChangeSetId: normalized.proposedChangeSetId,
        drawingIrFingerprint: normalized.drawingIrFingerprint,
        payload: normalized.payload,
        state: 'APPROVED_LOCKED',
        executionEnabled: false
      }).onConflictDoNothing({ target: sketchupExecutionPackages.packageHash }).returning();

      packageRecord = created ?? await getByHash(tx, normalized.packageHash);
      if (!packageRecord) throw new Error('EXECUTION_PACKAGE_PERSIST_FAILED');
      if (packageRecord.proposedChangeSetId !== normalized.proposedChangeSetId) {
        throw new Error('EXECUTION_PACKAGE_HASH_COLLISION_OR_CONFLICT');
      }
    }

    if (packageRecord.state !== 'APPROVED_LOCKED' || packageRecord.executionEnabled) {
      throw new Error('EXECUTION_PACKAGE_LEDGER_GUARD_VIOLATION');
    }
    if (packageRecord.drawingIrFingerprint !== normalized.drawingIrFingerprint) {
      throw new Error('EXECUTION_PACKAGE_PERSISTED_DRAWING_FINGERPRINT_MISMATCH');
    }
    if (packageRecord.draftFingerprint !== normalized.draftFingerprint) {
      throw new Error('EXECUTION_PACKAGE_PERSISTED_DRAFT_FINGERPRINT_MISMATCH');
    }

    const [existingApproval] = await tx.select().from(sketchupExecutionPackageApprovals)
      .where(eq(sketchupExecutionPackageApprovals.packageId, packageRecord.id)).limit(1);

    if (existingApproval) {
      const matches = existingApproval.decision === 'APPROVE_EXECUTION_PACKAGE'
        && existingApproval.approvedBy === normalized.approvedBy
        && existingApproval.note === normalized.note
        && existingApproval.expectedDrawingIrFingerprint === normalized.expectedDrawingIrFingerprint
        && existingApproval.expectedProposedChangeSetId === normalized.expectedProposedChangeSetId;
      if (!matches) throw new Error('EXECUTION_PACKAGE_APPROVAL_CONFLICT');
      return { package: packageRecord, approval: existingApproval, idempotent: true as const };
    }

    const [approval] = await tx.insert(sketchupExecutionPackageApprovals).values({
      packageId: packageRecord.id,
      decision: 'APPROVE_EXECUTION_PACKAGE',
      approvedBy: normalized.approvedBy,
      note: normalized.note,
      expectedDrawingIrFingerprint: normalized.expectedDrawingIrFingerprint,
      expectedProposedChangeSetId: normalized.expectedProposedChangeSetId
    }).returning();

    if (!approval) throw new Error('EXECUTION_PACKAGE_APPROVAL_PERSIST_FAILED');
    return { package: packageRecord, approval, idempotent: false as const };
  });
}
