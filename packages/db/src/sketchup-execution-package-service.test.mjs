import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import postgres from 'postgres';
import {
  approveSketchUpExecutionPackage,
  createDatabase,
  getApprovedSketchUpExecutionPackage
} from './index.ts';

const databaseUrl = process.env.ARCHON_LEDGER_TEST_DATABASE_URL;
const maybeTest = databaseUrl ? test : test.skip;

function id(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function fixture(overrides = {}) {
  const proposedChangeSetId = id('DRAW-CS');
  const drawingIrFingerprint = crypto.randomBytes(8).toString('hex');
  const draftFingerprint = crypto.randomBytes(8).toString('hex');
  const payload = {
    schema: 'archon.sketchup-execution-package.v1',
    state: 'APPROVAL_READY',
    source: { proposedChangeSetId, drawingIrFingerprint },
    safety: { executionEnabled: false, geometryMutationAllowed: false }
  };
  const packageHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return {
    packageHash,
    draftFingerprint,
    projectRef: 'TEST-OFFICE',
    proposedChangeSetId,
    drawingIrFingerprint,
    payload,
    approvedBy: 'ci-reviewer',
    note: 'CI governed package approval',
    expectedDrawingIrFingerprint: drawingIrFingerprint,
    expectedProposedChangeSetId: proposedChangeSetId,
    ...overrides
  };
}

maybeTest('approved SketchUp execution package is durable, locked and idempotent', async () => {
  const db = createDatabase(databaseUrl);
  const input = fixture();

  const first = await approveSketchUpExecutionPackage(db, input);
  assert.equal(first.idempotent, false);
  assert.equal(first.package.state, 'APPROVED_LOCKED');
  assert.equal(first.package.executionEnabled, false);
  assert.equal(first.approval.decision, 'APPROVE_EXECUTION_PACKAGE');

  const second = await approveSketchUpExecutionPackage(db, input);
  assert.equal(second.idempotent, true);
  assert.equal(second.package.id, first.package.id);
  assert.equal(second.approval.id, first.approval.id);

  const loaded = await getApprovedSketchUpExecutionPackage(db, input.packageHash);
  assert.equal(loaded?.package.id, first.package.id);
  assert.equal(loaded?.approval?.id, first.approval.id);
});

maybeTest('same proposed ChangeSet cannot be rebound to a different package hash', async () => {
  const db = createDatabase(databaseUrl);
  const input = fixture();
  await approveSketchUpExecutionPackage(db, input);

  await assert.rejects(
    approveSketchUpExecutionPackage(db, {
      ...input,
      packageHash: crypto.randomBytes(32).toString('hex')
    }),
    /EXECUTION_PACKAGE_CHANGESET_ALREADY_BOUND/
  );
});

maybeTest('fingerprint mismatch fails before persistence', async () => {
  const db = createDatabase(databaseUrl);
  const input = fixture();
  await assert.rejects(
    approveSketchUpExecutionPackage(db, {
      ...input,
      expectedDrawingIrFingerprint: crypto.randomBytes(8).toString('hex')
    }),
    /EXECUTION_PACKAGE_DRAWING_FINGERPRINT_MISMATCH/
  );
});

maybeTest('database triggers reject mutation and deletion of governed records', async () => {
  const db = createDatabase(databaseUrl);
  const input = fixture();
  const approved = await approveSketchUpExecutionPackage(db, input);
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    await assert.rejects(
      sql`UPDATE sketchup_execution_packages SET project_ref='MUTATED' WHERE id=${approved.package.id}`,
      /ARCHON_SKETCHUP_EXECUTION_PACKAGE_IMMUTABLE/
    );
    await assert.rejects(
      sql`DELETE FROM sketchup_execution_package_approvals WHERE id=${approved.approval.id}`,
      /ARCHON_SKETCHUP_EXECUTION_PACKAGE_IMMUTABLE/
    );
  } finally {
    await sql.end();
  }
});
