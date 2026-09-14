import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommandCenterPreview } from './command-center.ts';

const objects = [
  { archonId: 'archon_wall_south', objectType: 'WALL', parameters: { label: 'South wall' } },
  { archonId: 'archon_wall_north', objectType: 'WALL', parameters: { label: 'North wall' } },
  { archonId: 'archon_room_kitchen', objectType: 'ROOM', parameters: { label: 'Kitchen' } },
  { archonId: 'archon_slab_ground', objectType: 'SLAB', parameters: { label: 'Ground slab' } }
];

test('south wall command becomes a governed sandbox move preview', () => {
  const preview = createCommandCenterPreview({ prompt: 'Move south wall 500 mm outward for DWG test', canonicalObjects: objects });
  assert.equal(preview.state, 'SANDBOX_PREVIEW_READY');
  assert.deepEqual(preview.proposedChangeSet.operations, [{ type: 'MOVE', targetId: 'archon_wall_south', payload: { deltaZmm: 500 } }]);
  assert.equal(preview.proposedChangeSet.canSubmit, true);
  assert.equal(preview.governance.approvedGraphMutated, false);
  assert.equal(preview.governance.realApsJobSubmitted, false);
  assert.equal(preview.drawingPlan.layerMapping.walls, 'ARCHON_WALLS');
});

test('kitchen resize command becomes a dimension update against the canonical room', () => {
  const preview = createCommandCenterPreview({ prompt: 'Resize kitchen width to 7.2 m', canonicalObjects: objects });
  assert.equal(preview.intent.targetArchonId, 'archon_room_kitchen');
  assert.deepEqual(preview.proposedChangeSet.operations, [{ type: 'UPDATE', targetId: 'archon_room_kitchen', payload: { widthMm: 7200 } }]);
});

test('ambiguous wall command requests target review and does not create an unsafe operation', () => {
  const preview = createCommandCenterPreview({ prompt: 'Move wall 500 mm', canonicalObjects: objects });
  assert.equal(preview.state, 'NEEDS_TARGET_REVIEW');
  assert.equal(preview.proposedChangeSet.operations.length, 0);
  assert.equal(preview.targetCandidates.length, 2);
  assert.ok(preview.proposedChangeSet.blockedBy.includes('NO_PROPOSED_GRAPH_OPERATION'));
});

test('active changeset blocks submission while preserving preview', () => {
  const preview = createCommandCenterPreview({ prompt: 'Move north wall 500 mm', canonicalObjects: objects, activeChangeSetId: 'active-1' });
  assert.equal(preview.state, 'SANDBOX_PREVIEW_READY');
  assert.equal(preview.proposedChangeSet.canSubmit, false);
  assert.ok(preview.proposedChangeSet.blockedBy.includes('ACTIVE_CHANGESET_EXISTS'));
});

test('drawing-only CAD prompts remain preview-only with external sync locked', () => {
  const preview = createCommandCenterPreview({ prompt: 'Generate CAD layer mapping with site boundary, room labels and dimensions', canonicalObjects: objects });
  assert.equal(preview.state, 'DRAWING_SANDBOX_PLAN_READY');
  assert.equal(preview.proposedChangeSet.operations.length, 0);
  assert.equal(preview.drawingPlan.externalSync, 'LOCKED');
  assert.equal(preview.governance.externalSyncExecuted, false);
});

test('explicit target selection resolves an ambiguous wall command into a safe preview', () => {
  const preview = createCommandCenterPreview({ prompt: 'Move wall 500 mm', canonicalObjects: objects, targetArchonId: 'archon_wall_north' });
  assert.equal(preview.state, 'SANDBOX_PREVIEW_READY');
  assert.equal(preview.intent.targetArchonId, 'archon_wall_north');
  assert.deepEqual(preview.proposedChangeSet.operations, [{ type: 'MOVE', targetId: 'archon_wall_north', payload: { deltaZmm: -500 } }]);
});

