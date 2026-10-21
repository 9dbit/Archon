import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareNativeGeneratorPlan } from './prepare-generator-plan.mjs';

const discovery = Object.freeze({
  state: 'VERIFIED',
  authVerified: true,
  automationApiVerified: true,
  executionEnabled: false,
  revitEngines: ['Autodesk.Revit+2026']
});

test('generator plan has isolated Revit engine, input seed and JSON, native outputs',()=>{
  const p=prepareNativeGeneratorPlan('archon_pilot',discovery);
  assert.equal(p.engine,'Autodesk.Revit+2026');
  assert.equal(p.appBundle.id,'ArchonRevitGeneratePilot');
  assert.deepEqual(Object.keys(p.activity.parameters),
    ['inputRvt','geometry','outputRvt','report']);
  assert.equal(p.activity.parameters.inputRvt.verb,'get');
  assert.equal(p.activity.parameters.geometry.verb,'get');
  assert.equal(p.activity.parameters.outputRvt.verb,'put');
  assert.equal(p.activity.parameters.report.verb,'put');
  assert.match(p.activity.commandLine[0],/revitcoreconsole\.exe/);
  assert.match(p.activity.commandLine[0],/\/i "\$\(args\[inputRvt\]\.path\)"/);
  assert.equal(p.activity.appbundles[0],'archon_pilot.ArchonRevitGeneratePilot+pilot_v1');
  assert.equal(p.executionEnabled,false);
  assert.equal(p.provisioningEnabled,false);
  assert.equal(p.approvedForProduction,false);
  assert.equal(p.workitemRetries,0);
  assert.equal(p.maxConcurrentWorkItems,1);
  assert.equal(p.customerModelAccessEnabled,false);
  assert.doesNotMatch(JSON.stringify(p),/https:|CLIENT_SECRET|access_token/);
});
test('invalid namespace is rejected',()=>{
  for(const name of ['', 'dot.bad', '../bad','bad-name','a'.repeat(21)]){
    assert.throws(()=>prepareNativeGeneratorPlan(name,discovery),
      /REVIT_GENERATOR_NAMESPACE_INVALID/);
  }
});
test('unverified/missing engine cannot create an offline generator plan',()=>{
  for(const bad of [null,{}, {...discovery,state:'FAILED'},
    {...discovery,executionEnabled:true},{...discovery,revitEngines:['Autodesk.Revit+2025']}]) {
    assert.throws(()=>prepareNativeGeneratorPlan('archon_pilot',bad),
      /REVIT_GENERATOR_ENGINE_NOT_VERIFIED/);
  }
});
