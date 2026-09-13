import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectApsWorkitem,finalizeGovernedSandbox,resolvePinnedSandboxSourceVersion} from './sandbox-lifecycle.mjs';
import {sealSandboxReceipt} from './sandbox-receipt.mjs';
const workitemId='job-1',secret='a'.repeat(64);
test('APS lifecycle inspection is read-only and redacts OAuth and report URLs',async()=>{
 const calls=[];const fetcher=async(url,options={})=>{calls.push({url,options});return url.endsWith('/token')?Response.json({access_token:'private-token'}):Response.json({id:workitemId,status:'inprogress',reportUrl:'https://private.example/report'});};
 const result=await inspectApsWorkitem({workitemId,env:{APS_CLIENT_ID:'client',APS_CLIENT_SECRET:'secret'},fetcher});
 assert.equal(result.state,'APS_WORKITEM_PENDING');assert.equal(result.providerReportAvailable,true);assert.ok(!JSON.stringify(result).includes('private'));
 assert.equal(calls.length,2);assert.ok(calls.every(x=>(x.options.method??'GET')!=='POST'||x.url.endsWith('/token')));
});
test('malformed IDs, credentials, and provider states fail closed',async()=>{
 await assert.rejects(inspectApsWorkitem({workitemId:'../job',env:{}}),/CONFIGURATION_INVALID/);
 const fetcher=async url=>url.endsWith('/token')?Response.json({access_token:'x'}):Response.json({id:workitemId,status:'mystery'});
 await assert.rejects(inspectApsWorkitem({workitemId,env:{APS_CLIENT_ID:'c',APS_CLIENT_SECRET:'s'},fetcher}),/RESPONSE_INVALID/);
});
function harness(state='APS_WORKITEM_SUCCEEDED'){
 const manifest='11c7ecb2277e21f44365fd23cc0b301c22a60925e3df72b39f0f19e900763d8f',runId='archon-layout-smoke-20260912-v1',calls=[];
 const sealed=sealSandboxReceipt({receipt:{schemaVersion:1,runId,bucketKey:'archon_sandbox_'+'b'.repeat(24),outputs:[{argument:'outputDwg',key:runId+'/archon-output.dwg',uploadKey:'u1'},{argument:'report',key:runId+'/archon-report.json',uploadKey:'u2'}],expiresAt:new Date(5000).toISOString()},runId,manifestSha256:manifest,secret,now:()=>1000});
 const row={run_id:runId,manifest_sha256:manifest,workitem_id:workitemId,ciphertext:sealed.ciphertext,iv:sealed.iv,auth_tag:sealed.authTag,expires_at:sealed.expiresAt};
 const ledger={lookup:async()=>{calls.push('lookup');return {...row,state:'SUBMITTED'};}};
 const receiptStore={claimFinalization:async()=>{calls.push('claim');return row;},markConsumed:async()=>{calls.push('consumed');},markUnknown:async()=>{calls.push('unknown');}};
 const namespace='kGcY7aMipAtRf8kS0SulmGsoiIU1E1HiGc5X40rkeE8twyps';
 const env={ARCHON_SANDBOX_FINALIZATION_ENABLED:'true',ARCHON_SANDBOX_RECEIPT_KEY:secret,APS_ACTIVITY_ID:namespace+'.ArchonGenerateLayout+v0_1',APS_APPBUNDLE_ID:namespace+'.ArchonLayoutBundle+v0_1',APS_AUTOCAD_ENGINE:'Autodesk.AutoCAD+25_1'};
 return {env,now:()=>1000,withStores:work=>work({ledger,receiptStore}),inspectWorkitem:async()=>{calls.push('inspect');return {state,workitemId,status:state==='APS_WORKITEM_SUCCEEDED'?'success':'inprogress',executionEnabled:false,approvalGranted:false};},finalizeArtifacts:async()=>{calls.push('artifacts');return {state:'ARTIFACTS_REQUIRE_ARCHON_REVIEW',approvalGranted:false,reconciliation:'PROPOSE_CHANGESET_ONLY'};},calls};
}
test('pending workitem does not claim receipt or inspect artifacts',async()=>{const h=harness('APS_WORKITEM_PENDING');const result=await finalizeGovernedSandbox(h);assert.equal(result.reconciliation,'NONE');assert.deepEqual(h.calls,['lookup','inspect']);});
test('success claims, decrypts, validates, then consumes receipt without approval',async()=>{const h=harness();const result=await finalizeGovernedSandbox(h);assert.equal(result.approvalGranted,false);assert.deepEqual(h.calls,['lookup','inspect','claim','artifacts','consumed']);});
test('artifact ambiguity makes receipt UNKNOWN and never grants approval',async()=>{const h=harness();h.finalizeArtifacts=async()=>{h.calls.push('artifacts');throw Error('private-url');};await assert.rejects(finalizeGovernedSandbox(h),/^Error: SANDBOX_OUTPUT_FINALIZATION_UNKNOWN$/);assert.deepEqual(h.calls,['lookup','inspect','claim','artifacts','unknown']);});
test('finalization remains disabled before database and APS',async()=>{const h=harness();h.env.ARCHON_SANDBOX_FINALIZATION_ENABLED='false';await assert.rejects(finalizeGovernedSandbox(h),/FINALIZATION_DISABLED/);assert.deepEqual(h.calls,[]);});
test('source resolver only exposes the pinned synthetic preview version',()=>assert.equal(resolvePinnedSandboxSourceVersion(),'test-version'));
