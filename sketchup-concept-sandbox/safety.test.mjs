import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sandbox = readFileSync(new URL('./archon_concept_sandbox/main.rb', import.meta.url), 'utf8');
const executor = readFileSync(new URL('../sketchup-extension/archon/executor.rb', import.meta.url), 'utf8');

test('sandbox checks blank and unsaved model', () => {
  assert.match(sandbox, /SANDBOX_ONLY_UNSAVED_MODEL/);
  assert.match(sandbox, /SANDBOX_ONLY_EMPTY_MODEL/);
  assert.match(sandbox, /model\.path\.to_s\.empty\?/);
  assert.match(sandbox, /model\.entities\.length\.zero\?/);
});
test('local explicit approval required', () => {
  assert.match(sandbox, /MB_YESNO/);
  assert.match(sandbox, /response == 6/);
  assert.doesNotMatch(sandbox, /model\.save|save_as/);
});
test('one undoable transaction with rollback', () => {
  assert.match(sandbox, /model\.start_operation/);
  assert.match(sandbox, /model\.commit_operation/);
  assert.match(sandbox, /model\.abort_operation/);
});
test('existing ARCHON governed executor remains locked', () => {
  assert.match(executor, /raise 'ARCHON_EXECUTOR_GATE_LOCKED'/);
});
