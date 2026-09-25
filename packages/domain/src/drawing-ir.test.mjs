import test from 'node:test';
import assert from 'node:assert/strict';
import { createLayoutReviewProposal } from './drawing-ir.ts';

const prompt = 'Buat office 18 x 24 meter, reception, 2 meeting room, director room, open office untuk 20 staff, pantry, toilet pria, toilet wanita dan storage. Corridor minimum 1.2 m, dinding 100 mm.';

test('selected candidate becomes deterministic read-only drawing IR', () => {
  const proposal = createLayoutReviewProposal({ prompt, candidateId: 'OPTION_A' });

  assert.equal(proposal.schema, 'archon.layout-review-proposal.v1');
  assert.equal(proposal.state, 'REVIEW_READY');
  assert.equal(proposal.mutation, 'none');
  assert.equal(proposal.governance.approvalGranted, false);
  assert.equal(proposal.governance.sketchUpGeometryMutated, false);
  assert.equal(proposal.governance.executionEnabled, false);
  assert.equal(proposal.drawingIR.schema, 'archon.sketchup-drawing-ir.v1');
  assert.equal(proposal.drawingIR.units, 'mm');
  assert.ok(proposal.drawingIR.operations.some(operation => operation.op === 'CREATE_ROOM'));
  assert.ok(proposal.drawingIR.operations.some(operation => operation.op === 'CREATE_WALL'));
  assert.ok(proposal.drawingIR.operations.some(operation => operation.op === 'CREATE_DOOR'));
  assert.ok(proposal.drawingIR.operations.some(operation => operation.op === 'CREATE_LABEL'));
  assert.equal(proposal.proposedChangeSet.executable, false);
  assert.equal(proposal.proposedChangeSet.approvalGranted, false);
  assert.equal(proposal.proposedChangeSet.operationCount, proposal.drawingIR.operationCount);
});

test('same prompt, candidate and edits create the same fingerprint', () => {
  const input = {
    prompt,
    candidateId: 'OPTION_B',
    edits: [{ roomId: 'ROOM-001', widthMm: 3800, depthMm: 4200 }]
  };
  const first = createLayoutReviewProposal(input);
  const second = createLayoutReviewProposal(input);

  assert.equal(first.drawingIR.deterministicFingerprint, second.drawingIR.deterministicFingerprint);
  assert.equal(first.proposedChangeSet.id, second.proposedChangeSet.id);
});

test('review edits rebuild walls and remain non-executable', () => {
  const proposal = createLayoutReviewProposal({
    prompt,
    candidateId: 'OPTION_A',
    edits: [{ roomId: 'ROOM-001', widthMm: 3600, depthMm: 4000 }]
  });
  const edited = proposal.reviewedCandidate.rooms.find(room => room.roomId === 'ROOM-001');

  assert.equal(edited?.widthMm, 3600);
  assert.equal(edited?.depthMm, 4000);
  assert.equal(proposal.proposedChangeSet.executable, false);
  assert.equal(proposal.checklist.at(-1)?.status, 'LOCKED');
});

test('overlapping operator edit blocks proposed ChangeSet', () => {
  const base = createLayoutReviewProposal({ prompt, candidateId: 'OPTION_A' });
  const first = base.reviewedCandidate.rooms[0];
  const second = base.reviewedCandidate.rooms[1];

  const blocked = createLayoutReviewProposal({
    prompt,
    candidateId: 'OPTION_A',
    edits: [{
      roomId: second.roomId,
      xMm: first.xMm,
      yMm: first.yMm,
      widthMm: second.widthMm,
      depthMm: second.depthMm
    }]
  });

  assert.equal(blocked.state, 'REVIEW_BLOCKED');
  assert.equal(blocked.proposedChangeSet.state, 'BLOCKED');
  assert.ok(blocked.validation.some(finding => finding.code === 'ROOM_OVERLAP' && finding.severity === 'BLOCKER'));
  assert.equal(blocked.proposedChangeSet.executable, false);
});

test('room outside footprint is blocked', () => {
  const blocked = createLayoutReviewProposal({
    prompt,
    candidateId: 'OPTION_A',
    edits: [{ roomId: 'ROOM-001', xMm: 17900, yMm: 0 }]
  });

  assert.equal(blocked.state, 'REVIEW_BLOCKED');
  assert.ok(blocked.validation.some(finding => finding.code === 'ROOM_OUTSIDE_FOOTPRINT'));
});

test('unknown candidate and room edit fail closed', () => {
  assert.throws(() => createLayoutReviewProposal({ prompt, candidateId: 'OPTION_Z' }), /DRAWING_IR_CANDIDATE_NOT_FOUND/);
  assert.throws(() => createLayoutReviewProposal({
    prompt,
    candidateId: 'OPTION_A',
    edits: [{ roomId: 'ROOM-999', widthMm: 3000 }]
  }), /DRAWING_IR_UNKNOWN_ROOM_EDIT/);
});
