import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const worker = fileURLToPath(new URL('./worker.mjs', import.meta.url));
function run(mode, overrideEnv = {}) {
  return spawnSync(process.execPath, [worker], {
    encoding: 'utf8',
    timeout: 10000,
    env: {
      PATH: process.env.PATH,
      ARCHON_REVIT_APS_WORKER_EXIT: '1',
      ARCHON_REVIT_APS_WORKER_MODE: mode,
      ARCHON_REVIT_APS_CLIENT_ID: 'SHOULD_NOT_LEAK_CLIENT_ID',
      ARCHON_REVIT_APS_CLIENT_SECRET: 'SHOULD_NOT_LEAK_SECRET',
      APS_CLIENT_SECRET: 'LEGACY_SECRET_MUST_NOT_LEAK',
      ...overrideEnv
    }
  });
}

test('offline worker succeeds without outbound calls or exposing secrets', () => {
  const result = run('OFFLINE');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"state":"OFFLINE_READY"/);
  assert.match(result.stdout, /"executionEnabled":false/);
  assert.doesNotMatch(result.stdout + result.stderr, /SHOULD_NOT_LEAK|LEGACY_SECRET/);
});

test('forbidden worker mode fails closed, never performing resource writes', () => {
  for (const mode of ['APPLY', 'WORKITEM', 'ACTIVITY']) {
    const result = run(mode);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /REVIT_WORKER_MODE_INVALID/);
    assert.match(result.stdout, /"executionEnabled":false/);
  }
});

test('audit mode without credentials fails closed and never exposes legacy secrets', () => {
  const result = run('AUDIT', {
    ARCHON_REVIT_APS_CLIENT_ID: '',
    ARCHON_REVIT_APS_CLIENT_SECRET: ''
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /"state":"NOT_CONFIGURED"/);
  assert.match(result.stdout, /"provisioningEnabled":false/);
  assert.match(result.stdout, /"workitemsEnabled":false/);
  assert.doesNotMatch(result.stdout + result.stderr, /SHOULD_NOT_LEAK|LEGACY_SECRET/);
});
