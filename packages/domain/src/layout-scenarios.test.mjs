import test from 'node:test';
import assert from 'node:assert/strict';
import { createLayoutReviewProposal, createPromptLayoutPreview } from './index.ts';

const scenarios = [
  {
    name: 'office-medium',
    prompt: 'Buat kantor 18 x 24 meter, reception, 2 meeting room, director room, open office untuk 20 staff, pantry, toilet pria, toilet wanita dan storage. Corridor minimum 1.2 m. Dinding 100 mm.'
  },
  {
    name: 'office-large',
    prompt: 'Buat office 24 x 36 meter dengan reception, 3 meeting room, director room, 2 private office, open office untuk 40 staff, pantry, toilet pria, toilet wanita dan storage. Corridor minimum 1.5 m. Dinding 120 mm.'
  },
  {
    name: 'restaurant',
    prompt: 'Buat restaurant 20 x 32 meter dengan reception, main dining, private dining, bar, kitchen, pantry, storage, toilet pria dan toilet wanita. Corridor minimum 1.2 m. Dinding 100 mm.'
  }
];

for (const scenario of scenarios) {
  test(`${scenario.name}: at least one reviewable candidate and deterministic IR`, () => {
    const preview = createPromptLayoutPreview({ prompt: scenario.prompt });
    const candidate = preview.candidates.find(item => item.valid);

    assert.equal(preview.mutation, 'none');
    assert.ok(candidate, `${scenario.name} should have at least one valid candidate`);

    const first = createLayoutReviewProposal({ prompt: scenario.prompt, candidateId: candidate.id });
    const second = createLayoutReviewProposal({ prompt: scenario.prompt, candidateId: candidate.id });

    assert.equal(first.state, 'REVIEW_READY');
    assert.equal(first.mutation, 'none');
    assert.equal(first.governance.executionEnabled, false);
    assert.equal(first.proposedChangeSet.executable, false);
    assert.equal(first.drawingIR.deterministicFingerprint, second.drawingIR.deterministicFingerprint);
    assert.ok(first.drawingIR.operations.every(operation => operation.id));
    assert.ok(first.drawingIR.operations.filter(operation => operation.op === 'CREATE_DOOR').every(operation => operation.hostWallId !== 'UNRESOLVED'));
  });
}

test('small over-constrained office never becomes executable', () => {
  const prompt = 'Buat kantor 6 x 8 meter dengan 4 meeting room, director room, open office, pantry, toilet pria, toilet wanita dan storage. Corridor minimum 1.2 m.';
  const preview = createPromptLayoutPreview({ prompt });

  assert.equal(preview.mutation, 'none');
  assert.ok(preview.candidates.every(candidate => !candidate.valid));

  for (const candidate of preview.candidates) {
    const review = createLayoutReviewProposal({ prompt, candidateId: candidate.id });
    assert.equal(review.proposedChangeSet.executable, false);
    assert.equal(review.governance.sketchUpGeometryMutated, false);
  }
});
