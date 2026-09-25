import test from 'node:test';
import assert from 'node:assert/strict';
import { createLayoutReviewProposal } from './drawing-ir.ts';
import { createSketchUpExecutionPackageDraft } from './execution-package.ts';
import { createSketchUpExecutorDryRunPlan } from './sketchup-executor-plan.ts';

const prompt = 'Buat office 18 x 24 meter, reception, 2 meeting room, director room, open office untuk 20 staff, pantry, toilet pria, toilet wanita dan storage. Corridor minimum 1.2 m, dinding 100 mm.';

function fixture() {
  const review = createLayoutReviewProposal({ prompt, candidateId: 'OPTION_A' });
  const payload = createSketchUpExecutionPackageDraft({ review, projectRef: 'EXECUTOR-TEST' });
  return {
    packageHash: 'a'.repeat(64),
    packageState: 'APPROVED_LOCKED',
    executionEnabled: false,
    approvalReference: 'approval-test-001',
    approvalDecision: 'APPROVE_EXECUTION_PACKAGE',
    payload
  };
}

test('approved locked package becomes deterministic dry-run executor plan', () => {
  const input = fixture();
  const first = createSketchUpExecutorDryRunPlan(input);
  const second = createSketchUpExecutorDryRunPlan(input);

  assert.equal(first.schema, 'archon.sketchup-executor-plan.v1');
  assert.equal(first.state, 'DRY_RUN_READY');
  assert.equal(first.executionMode, 'NATIVE_2D_DRY_RUN');
  assert.equal(first.operationCount, input.payload.operationCount);
  assert.equal(first.deterministicFingerprint, second.deterministicFingerprint);
  assert.equal(first.safety.mutation, 'none');
  assert.equal(first.safety.sketchUpMutationEnabled, false);
  assert.equal(first.safety.rubyExecutorCalled, false);
  assert.equal(first.safety.transactionOpened, false);
  assert.equal(first.safety.requiredNextGate, 'APPROVE_SKETCHUP_EXECUTOR');
  assert.ok(first.summary.createRoom > 0);
  assert.ok(first.summary.createWall > 0);
  assert.ok(first.summary.createDoor > 0);
});

test('package must remain approved-locked and execution disabled', () => {
  assert.throws(
    () => createSketchUpExecutorDryRunPlan({ ...fixture(), packageState: 'APPROVAL_READY' }),
    /SKETCHUP_EXECUTOR_PACKAGE_NOT_LOCKED/
  );
  assert.throws(
    () => createSketchUpExecutorDryRunPlan({ ...fixture(), executionEnabled: true }),
    /SKETCHUP_EXECUTOR_PACKAGE_EXECUTION_ALREADY_ENABLED/
  );
});

test('source package safety contract cannot silently enable Ruby execution', () => {
  const input = fixture();
  const payload = structuredClone(input.payload);
  payload.safety.rubyExecutorAllowed = true;
  assert.throws(
    () => createSketchUpExecutorDryRunPlan({ ...input, payload }),
    /SKETCHUP_EXECUTOR_SOURCE_SAFETY_CONTRACT_INVALID/
  );
});

test('unresolved host wall blocks executor plan', () => {
  const input = fixture();
  const payload = structuredClone(input.payload);
  const door = payload.operations.find(operation => operation.op === 'CREATE_DOOR');
  assert.ok(door);
  door.hostWallId = 'WALL-DOES-NOT-EXIST';

  assert.throws(
    () => createSketchUpExecutorDryRunPlan({ ...input, payload }),
    /SKETCHUP_EXECUTOR_PLAN_BLOCKED:DOOR_HOST_WALL_UNRESOLVED/
  );
});

test('unsupported Drawing IR operation fails closed', () => {
  const input = fixture();
  const payload = structuredClone(input.payload);
  payload.operations.push({ op: 'DELETE_MODEL', id: 'OP-BAD' });
  payload.operationCount = payload.operations.length;

  assert.throws(
    () => createSketchUpExecutorDryRunPlan({ ...input, payload }),
    /SKETCHUP_EXECUTOR_OPERATION_INVALID/
  );
});
