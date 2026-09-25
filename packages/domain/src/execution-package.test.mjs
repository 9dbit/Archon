import test from 'node:test';
import assert from 'node:assert/strict';
import { createLayoutReviewProposal } from './drawing-ir.ts';
import { createSketchUpExecutionPackageDraft } from './execution-package.ts';

const prompt = 'Buat office 18 x 24 meter, reception, 2 meeting room, director room, open office untuk 20 staff, pantry, toilet pria, toilet wanita dan storage. Corridor minimum 1.2 m, dinding 100 mm.';

test('review-ready proposal becomes deterministic execution package draft', () => {
  const review = createLayoutReviewProposal({ prompt, candidateId: 'OPTION_A' });
  const first = createSketchUpExecutionPackageDraft({ review, projectRef: 'IDN-OFFICE' });
  const second = createSketchUpExecutionPackageDraft({ review, projectRef: 'IDN-OFFICE' });

  assert.equal(first.schema, 'archon.sketchup-execution-package.v1');
  assert.equal(first.state, 'APPROVAL_READY');
  assert.equal(first.source.proposedChangeSetId, review.proposedChangeSet.id);
  assert.equal(first.source.drawingIrFingerprint, review.drawingIR.deterministicFingerprint);
  assert.equal(first.operationCount, review.drawingIR.operationCount);
  assert.equal(first.draftFingerprint, second.draftFingerprint);
  assert.deepEqual(first.operations, review.drawingIR.operations);
});

test('execution package remains packaging-only and mutation locked', () => {
  const review = createLayoutReviewProposal({ prompt, candidateId: 'OPTION_A' });
  const draft = createSketchUpExecutionPackageDraft({ review });

  assert.equal(draft.safety.packagingApprovalOnly, true);
  assert.equal(draft.safety.geometryMutationAllowed, false);
  assert.equal(draft.safety.executionEnabled, false);
  assert.equal(draft.safety.rubyExecutorAllowed, false);
  assert.equal(draft.safety.approvedBuildingStateMutated, false);
  assert.equal(draft.safety.requiredNextGate, 'APPROVE_SKETCHUP_EXECUTOR');
});

test('blocked review cannot become execution package', () => {
  const base = createLayoutReviewProposal({ prompt, candidateId: 'OPTION_A' });
  const firstRoom = base.reviewedCandidate.rooms[0];
  const secondRoom = base.reviewedCandidate.rooms[1];
  const blocked = createLayoutReviewProposal({
    prompt,
    candidateId: 'OPTION_A',
    edits: [{
      roomId: secondRoom.roomId,
      xMm: firstRoom.xMm,
      yMm: firstRoom.yMm
    }]
  });

  assert.equal(blocked.state, 'REVIEW_BLOCKED');
  assert.throws(
    () => createSketchUpExecutionPackageDraft({ review: blocked }),
    /EXECUTION_PACKAGE_REVIEW_NOT_READY/
  );
});

test('project reference is normalized and bounded', () => {
  const review = createLayoutReviewProposal({ prompt, candidateId: 'OPTION_A' });
  const draft = createSketchUpExecutionPackageDraft({ review, projectRef: '  OFFICE-001  ' });
  assert.equal(draft.projectRef, 'OFFICE-001');

  assert.throws(
    () => createSketchUpExecutionPackageDraft({ review, projectRef: 'x'.repeat(161) }),
    /EXECUTION_PACKAGE_PROJECT_REF_TOO_LONG/
  );
});
