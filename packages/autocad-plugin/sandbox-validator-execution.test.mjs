import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createPinnedSandboxReview} from './sandbox-review.mjs';
import {executeGovernedSandboxValidator} from './sandbox-validator-execution.mjs';

const h=value=>createHash('sha256').update(value).digest('hex');
const namespace='owner',runId='archon-layout-smoke-20260912-v1';
const env={APS_ACTIVITY_ID:namespace+'.ArchonGenerateLayout+v0_1',APS_APPBUNDLE_ID:namespace+'.ArchonLayoutBundle+v0_1',APS_AUTOCAD_ENGINE:'Autodesk.AutoCAD+25_1',APS_VALIDATOR_ACTIVITY_ID:namespace+'.ArchonValidateDrawing+v0_1',ARCHON_SANDBOX_VALIDATOR_TRANSPORT_ENABLED:'true'};
const review=createPinnedSandboxReview(env),dwgSha256='a'.repeat(64),reportSha256='b'.repeat(64),workitemId='generator-1';
function artifactRow(edit=()=>{}){
 const evidence={schemaVersion:1,runId,manifestSha256:review.manifestSha256,workitemId,stage:'ARTIFACTS_VALIDATED',dwgSha256,reportSha256,nativeDwgReopenVerified:false,reconciliation:'PROPOSE_CHANGESET_ONLY',approvalGranted:false,checklist:[]};edit(evidence);
 return {evidence_sha256:h(JSON.stringify(evidence)),run_id:evidence.runId,manifest_sha256:evidence.manifestSha256,workitem_id:evidence.workitemId,stage:evidence.stage,dwg_sha256:evidence.dwgSha256,report_sha256:evidence.reportSha256,evidence,approval_granted:evidence.approvalGranted};
}
function harness({existing,storeFails=false}={}){
 const calls=[],row=artifactRow();
 const reviewStore={lookup:async()=>{calls.push('review');return row;}};
 const validatorLedger={lookup:async()=>{calls.push('lookup');return existing??null;},claim:async v=>{calls.push('claim');return v;},begin:async()=>{calls.push('begin');},submitted:async(_run,id)=>{calls.push('submitted:'+id);},unknown:async()=>{calls.push('unknown');}};
 const validatorReceiptStore={storePrepared:async()=>{calls.push('receipt');if(storeFails)throw Error('private-db');}};
 const prepareTransport=async ({artifactEvidence,namespace:ns})=>{calls.push('preflight');assert.equal(ns,namespace);assert.equal(artifactEvidence.evidenceSha256,row.evidence_sha256);return {summary:{runId,manifestSha256:review.manifestSha256,inputDwgSha256:dwgSha256,activityId:env.APS_VALIDATOR_ACTIVITY_ID,executionEnabled:false,approvalGranted:false},persistBeforeSubmit:async store=>{calls.push('persist');await store.storePrepared({});},submitOnce:async submit=>{calls.push('submitOnce');const result=await submit({activityId:env.APS_VALIDATOR_ACTIVITY_ID,arguments:{inputDwg:{url:'https://bucket.s3.amazonaws.com/in',verb:'get'},reopenReport:{url:'https://bucket.s3.amazonaws.com/out',verb:'put'}}});return {id:result.id};}};};
 const submitWorkitem=async ({payload,executionEnabled})=>{calls.push('provider');assert.equal(executionEnabled,true);assert.equal(payload.activityId,env.APS_VALIDATOR_ACTIVITY_ID);return {id:'validator-1'};};
 const withStores=work=>work({reviewStore,validatorLedger,validatorReceiptStore});
 return {calls,withStores,prepareTransport,submitWorkitem};
}
test('governed validator persists receipt before exactly one provider submission',async()=>{
 const h=harness(),result=await executeGovernedSandboxValidator({env,withStores:h.withStores,prepareTransport:h.prepareTransport,submitWorkitem:h.submitWorkitem});
 assert.equal(result.state,'SANDBOX_VALIDATOR_WORKITEM_SUBMITTED');assert.equal(result.validatorWorkitemId,'validator-1');assert.equal(result.approvalGranted,false);assert.equal(result.reconciliation,'NONE');
 assert.deepEqual(h.calls,['lookup','review','preflight','claim','begin','persist','receipt','submitOnce','provider','submitted:validator-1']);
});
test('receipt persistence ambiguity locks run and prevents provider call',async()=>{
 const h=harness({storeFails:true});
 await assert.rejects(executeGovernedSandboxValidator({env,withStores:h.withStores,prepareTransport:h.prepareTransport,submitWorkitem:h.submitWorkitem}),/SUBMISSION_OUTCOME_UNKNOWN/);
 assert.deepEqual(h.calls,['lookup','review','preflight','claim','begin','persist','receipt','unknown']);
});
test('existing submitted validator is idempotent and never reopens transport',async()=>{
 const h=harness({existing:{state:'SUBMITTED',manifest_sha256:review.manifestSha256,validator_workitem_id:'validator-1'}});
 const result=await executeGovernedSandboxValidator({env,withStores:h.withStores,prepareTransport:h.prepareTransport,submitWorkitem:h.submitWorkitem});
 assert.equal(result.state,'SANDBOX_VALIDATOR_ALREADY_SUBMITTED');assert.deepEqual(h.calls,['lookup']);
});
test('disabled transport blocks before database and provider access',async()=>{
 const h=harness();
 await assert.rejects(executeGovernedSandboxValidator({env:{...env,ARCHON_SANDBOX_VALIDATOR_TRANSPORT_ENABLED:'false'},withStores:h.withStores,prepareTransport:h.prepareTransport,submitWorkitem:h.submitWorkitem}),/TRANSPORT_DISABLED/);
 assert.deepEqual(h.calls,[]);
});
