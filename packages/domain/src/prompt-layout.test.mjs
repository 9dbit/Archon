import test from 'node:test';
import assert from 'node:assert/strict';
import { createPromptLayoutPreview, parseLayoutPrompt } from './prompt-layout.ts';

test('parses Indonesian office prompt into a space program', () => {
  const program = parseLayoutPrompt('Buat kantor 12 x 20 meter untuk 20 staff, reception 4 x 5 meter, 2 meeting room, director room, open office, pantry, toilet pria dan toilet wanita. Corridor minimum 1.2 m. Dinding 100 mm.');

  assert.equal(program.footprint?.widthMm, 12000);
  assert.equal(program.footprint?.depthMm, 20000);
  assert.equal(program.wallThicknessMm, 100);
  assert.equal(program.corridorMinMm, 1200);
  assert.equal(program.rooms.filter(room => room.kind === 'MEETING').length, 2);
  assert.equal(program.rooms.find(room => room.kind === 'RECEPTION')?.targetWidthMm, 4000);
  assert.equal(program.rooms.find(room => room.kind === 'RECEPTION')?.targetDepthMm, 5000);
  assert.equal(program.rooms.find(room => room.kind === 'OPEN_OFFICE')?.capacity, 20);
  assert.equal(program.unresolved.length, 0);
});

test('preview creates three read-only candidate layouts', () => {
  const preview = createPromptLayoutPreview({
    prompt: 'Buat office 18 x 24 meter, reception, 2 meeting room, director room, open office untuk 20 staff, pantry, toilet pria, toilet wanita dan storage. Corridor minimum 1.2 m, dinding 100 mm.'
  });

  assert.equal(preview.schema, 'archon.prompt-layout-preview.v1');
  assert.equal(preview.mutation, 'none');
  assert.equal(preview.governance.sketchUpGeometryMutated, false);
  assert.equal(preview.governance.approvalGranted, false);
  assert.equal(preview.candidates.length, 3);
  assert.ok(preview.candidates.some(candidate => candidate.valid));
  assert.ok(preview.candidates.every(candidate => candidate.walls.length >= 4));
  assert.ok(preview.candidates.every(candidate => candidate.doors.length === preview.program.rooms.length));
});

test('missing footprint blocks solver instead of inventing dimensions', () => {
  const preview = createPromptLayoutPreview({
    prompt: 'Buat kantor dengan reception, meeting room, director room dan pantry.'
  });

  assert.equal(preview.state, 'LAYOUT_REQUIRES_INPUT');
  assert.equal(preview.candidates.length, 0);
  assert.ok(preview.program.unresolved.some(item => item.includes('footprint')));
});

test('unknown room request is not silently converted into geometry', () => {
  const preview = createPromptLayoutPreview({
    prompt: 'Buat bangunan 12 x 20 meter dengan ruang quantum teleportasi.'
  });

  assert.equal(preview.state, 'LAYOUT_REQUIRES_INPUT');
  assert.equal(preview.program.rooms.length, 0);
  assert.equal(preview.mutation, 'none');
});

test('over-constrained candidate remains reviewable but cannot mutate SketchUp', () => {
  const preview = createPromptLayoutPreview({
    prompt: 'Buat kantor 6 x 8 meter, 4 meeting room, director room, open office, pantry, toilet pria, toilet wanita, storage. Corridor minimum 1.2 m.'
  });

  assert.equal(preview.mutation, 'none');
  assert.ok(preview.candidates.some(candidate => candidate.findings.some(finding => finding.severity === 'BLOCKER')));
  assert.equal(preview.checklist.at(-1)?.status, 'LOCKED');
});
