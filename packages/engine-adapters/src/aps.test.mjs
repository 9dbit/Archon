import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApsAuthService, ApsAutomationService, getApsDiagnostics, createDwgPipelinePlan, startApsConnectionProbe, getApsConnectionStatus } from './aps.ts';
const config = { clientId: 'test-id', clientSecret: 'test-secret', engineId: 'Autodesk.AutoCAD+24_3', activityId: 'owner.layout+dev', appBundleId: 'owner.bundle+dev' };
test('missing credentials and configuration cause zero network calls', async () => {
  let calls = 0; const request = async () => { calls++; throw Error('network'); };
  const auth = new ApsAuthService({}, request);
  await assert.rejects(auth.getToken(), /APS_CREDENTIALS_MISSING/);
  const probe = await new ApsAutomationService({}, auth, request).handshake();
  assert.equal(probe.verified, false); assert.equal(calls, 0);
  const status = getApsDiagnostics(config); assert.equal(JSON.stringify(status).includes('test-secret'), false);
  assert.equal(status.callbackRequiredForAutomation, false);
});
test('tokens are cached, single flight, and refreshed before expiry', async () => {
  let clock = 0, calls = 0;
  const request = async (url, options) => {
    calls++; assert.match(url, /authentication\/v2\/token$/);
    assert.equal(options.redirect, 'error'); assert.equal(options.headers.Authorization, 'Basic ' + Buffer.from('test-id:test-secret').toString('base64'));
    assert.match(options.body, /code%3Aall/);
    return Response.json({ access_token: 'private-token-' + calls, token_type: 'Bearer', expires_in: 120 });
  };
  const auth = new ApsAuthService(config, request, () => clock);
  await Promise.all([auth.getToken(), auth.getToken()]); assert.equal(calls, 1);
  await auth.getToken(); assert.equal(calls, 1);
  clock = 61000; await auth.getToken(); assert.equal(calls, 2);
  auth.invalidate(); await auth.getToken(); assert.equal(calls, 3);
});
test('malformed tokens and failed authentication are rejected', async () => {
  for (const value of [null, {}, {access_token:'x',token_type:'Basic',expires_in:120}, {access_token:'x',token_type:'Bearer',expires_in:0}]) {
    await assert.rejects(new ApsAuthService(config, async () => Response.json(value)).getToken(), /APS_TOKEN_INVALID/);
  }
  await assert.rejects(new ApsAuthService(config, async () => new Response('secret', {status:401})).getToken(), /APS_AUTH_HTTP_401/);
});
test('handshake verifies engine, activity and bundle while execution stays blocked', async () => {
  const methods = [];
  const auth = new ApsAuthService(config, async () => Response.json({access_token:'private',token_type:'Bearer',expires_in:120}));
  const request = async (url, options) => { methods.push(options.method); return Response.json(url.includes('/activities/') ? {engine:config.engineId, appbundles:[config.appBundleId]} : {engine:config.engineId}); };
  const service = new ApsAutomationService(config, auth, request);
  const result = await service.handshake(); assert.equal(result.verified, true); assert.equal(result.executionEnabled, false);
  assert.deepEqual(methods, ['GET','GET','GET']);
  const source = {mode:'PREVIEW',versionId:'v1'}; const plan = createDwgPipelinePlan('job1',source,config);
  source.versionId = 'v2'; assert.equal(plan.source.versionId, 'v1');
  assert.equal(plan.units,'mm'); assert.equal(plan.reconciliation,'PROPOSE_CHANGESET_ONLY');
  await assert.rejects(service.submitWorkItem(plan), /APS_DWG_EXECUTION_DISABLED/);
  assert.equal(methods.length, 3);
});
test('resource mismatch and transport failures fail closed without secret diagnostics', async () => {
  const auth = new ApsAuthService(config, async () => { throw Error('test-secret'); });
  const failure = await new ApsAutomationService(config, auth).handshake();
  assert.deepEqual(failure.diagnostics,['APS_HANDSHAKE_FAILED']);
  const validAuth = new ApsAuthService(config, async () => Response.json({access_token:'x',token_type:'Bearer',expires_in:120}));
  const mismatch = await new ApsAutomationService(config, validAuth, async () => Response.json({engine:'wrong'})).handshake();
  assert.equal(mismatch.verified,false); assert.deepEqual(mismatch.diagnostics,['APS_RESOURCE_MISMATCH']);
  assert.throws(() => createDwgPipelinePlan('job',{mode:'PREVIEW',versionId:''}), /APS_SOURCE_VERSION_REQUIRED/);
});

test('credential-only discovery follows engine pages and never submits jobs', async () => {
  const calls = [];
  const credentials = {clientId:'id',clientSecret:'secret'};
  const auth = new ApsAuthService(credentials, async () => Response.json({access_token:'private',token_type:'Bearer',expires_in:120}));
  const request = async (url, options) => {
    calls.push({url,method:options.method});
    if (url.endsWith('/engines')) return Response.json({data:['Autodesk.Revit+2025'], paginationToken:'page/2'});
    if (url.includes('/engines?page=')) return Response.json({data:['Autodesk.AutoCAD+24_3']});
    return Response.json({data:[]});
  };
  const result = await new ApsAutomationService(credentials, auth, request).discover();
  assert.equal(result.authVerified,true); assert.equal(result.automationVerified,true);
  assert.deepEqual(result.autoCadEngines,['Autodesk.AutoCAD+24_3']);
  assert.equal(result.appBundleCount,0); assert.equal(result.activityCount,0);
  assert.equal(result.executionEnabled,false); assert.equal(calls.length,4);
  assert.equal(calls.every(call=>call.method==='GET'),true);
});
test('discovery preserves auth success when Automation access is denied', async () => {
  const auth = new ApsAuthService(config, async () => Response.json({access_token:'private',token_type:'Bearer',expires_in:120}));
  const result = await new ApsAutomationService(config,auth,async()=>new Response('secret',{status:403})).discover();
  assert.equal(result.authVerified,true); assert.equal(result.automationVerified,false);
  assert.deepEqual(result.diagnostics,['APS_AUTOMATION_HTTP_403']);
});
test('discovery rejects malformed pages and bounds pagination', async () => {
  const auth = new ApsAuthService(config, async () => Response.json({access_token:'private',token_type:'Bearer',expires_in:120}));
  let calls=0;
  const limited = await new ApsAutomationService(config,auth,async()=>{calls++; return Response.json({data:[],paginationToken:'loop'});}).discover();
  assert.deepEqual(limited.diagnostics,['APS_DISCOVERY_PAGE_LIMIT']); assert.equal(calls,5);
  const malformed = await new ApsAutomationService(config,auth,async()=>Response.json({data:[{secret:'x'}]})).discover();
  assert.deepEqual(malformed.diagnostics,['APS_RESOURCE_INVALID']);
});
test('startup probe runs once and public snapshots never expose or reacquire tokens', async () => {
  delete globalThis.__archonApsConnection;
  let calls=0; const credentials={clientId:'id',clientSecret:'secret'};
  const request=async(url)=>{
    calls++;
    if(url.endsWith('/token')) return Response.json({access_token:'private-token',token_type:'Bearer',expires_in:120});
    return Response.json({data:url.endsWith('/engines')?['Autodesk.AutoCAD+24_3']:[]});
  };
  assert.equal(getApsConnectionStatus().state,'NOT_PROBED'); assert.equal(calls,0);
  await Promise.all([startApsConnectionProbe(credentials,request),startApsConnectionProbe(credentials,request)]);
  assert.equal(calls,4);
  const result=getApsConnectionStatus(); assert.equal(result.state,'VERIFIED');
  result.autoCadEngines.length=0; assert.equal(getApsConnectionStatus().autoCadEngines.length,1);
  assert.equal(JSON.stringify(result).includes('private-token'),false);
  await startApsConnectionProbe(credentials,request); assert.equal(calls,4);
  delete globalThis.__archonApsConnection;
});
