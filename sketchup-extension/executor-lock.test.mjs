import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./archon/executor.rb', import.meta.url), 'utf8');

const forbiddenMutationApis = [
  'start_operation',
  'commit_operation',
  'abort_operation',
  'add_face',
  'add_line',
  'add_edges',
  'add_group',
  'add_instance',
  'erase_entities',
  'transform_entities',
  'transform!',
  'pushpull',
  'move!'
];

test('v0.3.3 executor candidate contains no SketchUp mutation API calls', () => {
  for (const api of forbiddenMutationApis) {
    assert.equal(source.includes(api), false, `executor.rb must not contain mutation API ${api}`);
  }
});

test('execute gate remains hard locked', () => {
  assert.match(source, /def execute!\(_plan\)/);
  assert.match(source, /raise 'ARCHON_EXECUTOR_GATE_LOCKED'/);
  assert.match(source, /'modelTransactionOpened' => false/);
  assert.match(source, /'geometryMutationAttempted' => false/);
  assert.match(source, /'requiredNextGate' => REQUIRED_NEXT_GATE/);
});
