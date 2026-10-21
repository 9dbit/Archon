import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareRevitPilotPlan } from './prepare-pilot.mjs';

const verified = Object.freeze({
  state: 'VERIFIED', authVerified: true, automationApiVerified: true,
  revitEngines: ['Autodesk.AutoCAD+25_1', 'Autodesk.Revit+2026'],
  executionEnabled: false
});

test('plan is isolated, read-only, quoted, and never executable', () => {
  const plan = prepareRevitPilotPlan('pilot_archon', verified);
  assert.equal(plan.engine, 'Autodesk.Revit+2026');
  assert.deepEqual(Object.keys(plan.activity.parameters), ['inputRvt', 'report']);
  assert.equal(plan.activity.parameters.inputRvt.verb, 'get');
  assert.equal(plan.activity.parameters.report.verb, 'put');
  assert.equal(plan.executionEnabled, false);
  assert.equal(plan.provisioningEnabled, false);
  assert.equal(plan.customerModelAccessEnabled, false);
  assert.match(plan.activity.commandLine[0], /revitcoreconsole\.exe/);
  assert.match(plan.activity.commandLine[0], /\/i "\$\(args\[inputRvt\]\.path\)"/);
  assert.match(plan.activity.commandLine[0], /\/al "\$\(appbundles\[ArchonRevitReadOnlyPilot\]\.path\)"/);
  assert.equal(JSON.stringify(plan).includes('clientSecret'), false);
  assert.equal(JSON.stringify(plan).includes('https://'), false);
});

test('refuse unverified engine and spoofed discovery responses', () => {
  for (const invalid of [
    null, {}, { ...verified, state: 'FAILED' },
    { ...verified, authVerified: false }, { ...verified, automationApiVerified: false },
    { ...verified, executionEnabled: true }, { ...verified, revitEngines: ['Autodesk.Revit+2025'] }
  ]) {
    assert.throws(() => prepareRevitPilotPlan('pilot_archon', invalid), /REVIT_ENGINE_NOT_VERIFIED/);
  }
});

test('reject namespaces containing injection and path characters', () => {
  for (const namespace of ['', 'one.two', 'my/name', '../bad', 'bad name', 'a'.repeat(101)]) {
    assert.throws(() => prepareRevitPilotPlan(namespace, verified), /REVIT_NAMESPACE_INVALID/);
  }
});
