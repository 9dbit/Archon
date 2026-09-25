import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./archon/executor.rb', import.meta.url), 'utf8');

const forbiddenPersistentApis = [
  'commit_operation',
  'erase_entities',
  'transform_entities',
  'transform!',
  'pushpull',
  'move!',
  '.save(',
  '.save_copy('
];

test('v0.3.4 rollback rehearsal exposes no persistent SketchUp mutation path', () => {
  for (const api of forbiddenPersistentApis) {
    assert.equal(source.includes(api), false, `executor.rb must not contain persistent mutation API ${api}`);
  }
});

test('rollback rehearsal opens a transaction but always aborts it', () => {
  assert.match(source, /def rollback_rehearsal\(plan\)/);
  assert.match(source, /model\.start_operation\('ARCHON Rollback Rehearsal', true\)/);
  assert.match(source, /ensure[\s\S]*model\.abort_operation/);
  assert.match(source, /root_after = model\.entities\.length/);
  assert.match(source, /ARCHON_EXECUTOR_ROLLBACK_VERIFY_FAILED/);
  assert.match(source, /'transactionCommitted' => false/);
  assert.match(source, /'transactionAborted' => true/);
  assert.match(source, /'persistentGeometryChanged' => false/);
});

test('rehearsal can only materialize the governed 2D operation set', () => {
  assert.match(source, /SUPPORTED_OPS = %w\[CREATE_ROOM CREATE_WALL CREATE_DOOR CREATE_LABEL\]/);
  assert.match(source, /parent_entities\.add_group/);
  assert.match(source, /entities\.add_line/);
  assert.match(source, /entities\.add_text/);
  assert.doesNotMatch(source, /add_face/);
  assert.doesNotMatch(source, /add_instance/);
});

test('persistent execute gate remains hard locked', () => {
  assert.match(source, /def execute!\(_plan\)/);
  assert.match(source, /raise 'ARCHON_EXECUTOR_GATE_LOCKED'/);
  assert.match(source, /'modelTransactionOpened' => false/);
  assert.match(source, /'geometryMutationAttempted' => false/);
  assert.match(source, /'requiredNextGate' => REQUIRED_NEXT_GATE/);
});
