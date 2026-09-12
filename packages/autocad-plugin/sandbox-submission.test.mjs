import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSandboxManifest} from './sandbox-manifest.mjs';
import {submitReviewedSandbox} from './sandbox-submission.mjs';
import {issueSandboxApproval,verifySandboxApproval} from './sandbox-approval.mjs';
const inputBytes=Buffer.from("{\"schemaVersion\":1,\"source\":{\"projectId\":\"test-only\",\"versionId\":\"test-version\",\"mode\":\"PREVIEW\",\"changeSetId\":\"test-preview-reference\",\"level\":\"Ground Floor\"},\"units\":\"mm\",\"coordinateMapping\":\"ARCHON_XZ_TO_CAD_XY\",\"entities\":[{\"kind\":\"POLYLINE\",\"sourceId\":\"test-site\",\"revision\":1,\"layer\":\"ARCHON_SITE\",\"closed\":true,\"pointsMm\":[[-5000,-4000],[5000,-4000],[5000,4000],[-5000,4000]]},{\"kind\":\"DIMENSION\",\"sourceId\":\"test-site\",\"revision\":1,\"layer\":\"ARCHON_DIMS\",\"startMm\":[-5000,-4000],\"endMm\":[5000,-4000],\"axis\":\"X\",\"measuredMm\":10000},{\"kind\":\"DIMENSION\",\"sourceId\":\"test-site\",\"revision\":1,\"layer\":\"ARCHON_DIMS\",\"startMm\":[-5000,-4000],\"endMm\":[-5000,4000],\"axis\":\"Z\",\"measuredMm\":8000},{\"kind\":\"POLYLINE\",\"sourceId\":\"test-wall\",\"revision\":1,\"layer\":\"ARCHON_WALLS\",\"closed\":true,\"pointsMm\":[[-5000,-4000],[5000,-4000],[5000,-3800],[-5000,-3800]]},{\"kind\":\"TEXT\",\"sourceId\":\"test-kitchen\",\"revision\":1,\"layer\":\"ARCHON_ROOMS\",\"positionMm\":[0,0],\"text\":\"Kitchen\"},{\"kind\":\"DIMENSION\",\"sourceId\":\"test-kitchen\",\"revision\":1,\"layer\":\"ARCHON_DIMS\",\"startMm\":[-2000,-1500],\"endMm\":[2000,-1500],\"axis\":\"X\",\"measuredMm\":4000},{\"kind\":\"DIMENSION\",\"sourceId\":\"test-kitchen\",\"revision\":1,\"layer\":\"ARCHON_DIMS\",\"startMm\":[-2000,-1500],\"endMm\":[-2000,1500],\"axis\":\"Z\",\"measuredMm\":3000}],\"excludedObjectIds\":[],\"checklist\":[{\"category\":\"geometry\",\"status\":\"PASS\",\"evidence\":\"Finite axis-aligned boxes inside supplied site rectangle; explicit single level.\"},{\"category\":\"dimensions\",\"status\":\"PASS\",\"evidence\":\"Dimension values derived from source coordinates in millimetres.\"},{\"category\":\"scope\",\"status\":\"PASS\",\"evidence\":\"Only site, walls, room labels and dimensions supported; excluded IDs recorded.\"},{\"category\":\"design/materials/rules\",\"status\":\"WARNING\",\"evidence\":\"Serialization does not validate circulation, materials, topology or construction compliance.\"},{\"category\":\"approval\",\"status\":\"WARNING\",\"evidence\":\"Source reference is descriptive. Existing governance must independently verify approval and freshness before any execution.\"}],\"executionEnabled\":false,\"reconciliation\":\"PROPOSE_CHANGESET_ONLY\"}");
const hash=b=>createHash('sha256').update(b).digest('hex');
function config() {
 const review=createSandboxManifest({inputBytes,expectedInputSha256:hash(inputBytes),runId:'test-run',seed:{state:'SEED_STORED_IN_SANDBOX',storedBytesVerified:true,executionEnabled:false,sha256:'a'.repeat(64),bytes:1000,dwgHeader:'AC1024',bucketKey:'archon_sandbox_'+'b'.repeat(24),objectKey:'seed-run/seed.dwg'},resources:{namespace:'test',engine:'Autodesk.AutoCAD+25_1',activityId:'test.ArchonGenerateLayout+v0_1',appBundleId:'test.ArchonLayoutBundle+v0_1',activityVersion:1,appBundleVersion:1,bundleSha256:'c'.repeat(64)}});
 const calls=[];let state;
 const ledger={async claim(){calls.push('claim');if(state)throw Error('SANDBOX_RUN_ALREADY_CLAIMED');state='CLAIMED';},async beginSubmission(){calls.push('begin');state='SUBMITTING';},async markSubmitted(){calls.push('submitted');state='SUBMITTED';},async markUnknown(){calls.push('unknown');state='UNKNOWN';}};
 const receiptStore={async storePrepared(){calls.push('receipt');}};
 const session=()=>({manifestSha256:review.manifestSha256,persistAfterClaim:store=>store.storePrepared(),submitOnce:fn=>fn()});
 return {review,inputBytes,approval:verifySandboxApproval({token:issueSandboxApproval({runId:'test-run',manifestSha256:review.manifestSha256,reference:'test-explicit-approval',expiresAt:2000,secret:'a'.repeat(64),now:()=>1000}),secret:'a'.repeat(64),runId:'test-run',manifestSha256:review.manifestSha256,now:()=>1000}),ledger,receiptStore,executionEnabled:true,now:()=>1000,calls,submit:async()=>{calls.push('provider');return {id:'workitem-1',privateToken:'secret'};},preflight:async()=>session()};
}
test('disabled execution, absent/mismatched/expired approval never reaches ledger or provider',async()=>{
 for(const edit of [c=>c.executionEnabled=false,c=>c.approval=undefined,c=>c.approval={...c.approval,manifestSha256:'d'.repeat(64)},c=>c.approval={...c.approval,expiresAt:1000},c=>c.review.manifest.resources.activityVersion=2]) {
 const c=config();edit(c);await assert.rejects(submitReviewedSandbox(c));assert.deepEqual(c.calls,[]);
 }
});
test('missing durable receipt store is rejected before preflight, ledger or provider',async()=>{
 const c=config();c.receiptStore=undefined;await assert.rejects(submitReviewedSandbox(c),/RECEIPT_STORE_REQUIRED/);assert.deepEqual(c.calls,[]);
});
test('receipt persistence failure makes the claimed run uncertain and prevents provider call',async()=>{
 const c=config();c.receiptStore.storePrepared=async()=>{c.calls.push('receipt');throw Error('private-db');};
 await assert.rejects(submitReviewedSandbox(c),/OUTCOME_UNKNOWN/);assert.deepEqual(c.calls,['claim','begin','receipt','unknown']);
});
test('exact approved manifest submits once after preflight and durable claim; duplicates do not reach provider',async()=>{
 const c=config();const r=await submitReviewedSandbox(c);assert.deepEqual(c.calls,['claim','begin','receipt','provider','submitted']);assert.equal(r.approvalGranted,false);assert.ok(!JSON.stringify(r).includes('secret'));
 await assert.rejects(submitReviewedSandbox(c),/ALREADY_CLAIMED/);assert.equal(c.calls.filter(x=>x==='provider').length,1);
});
test('timeout and failed persistence acknowledgement become uncertain without retry',async()=>{
 for(const failure of ['provider','ack']) {const c=config();if(failure==='provider')c.submit=async()=>{c.calls.push('provider');throw Error('private-token');};else c.ledger.markSubmitted=async()=>{throw Error('private-db-url');};
 await assert.rejects(submitReviewedSandbox(c),/^Error: SANDBOX_SUBMISSION_OUTCOME_UNKNOWN$/);assert.ok(c.calls.includes('unknown'));
 await assert.rejects(submitReviewedSandbox(c),/ALREADY_CLAIMED/);assert.equal(c.calls.filter(x=>x==='provider').length,1);}
});
test('approval expiry during preflight and tampered session binding stop before claim',async()=>{
 const c=config();let clock=1000;c.now=()=>clock;c.preflight=async()=>{clock=2001;return {manifestSha256:c.review.manifestSha256,persistAfterClaim:()=>{},submitOnce:fn=>fn()};};await assert.rejects(submitReviewedSandbox(c),/APPROVAL_REQUIRED/);assert.deepEqual(c.calls,[]);
 const d=config();d.preflight=async()=>({manifestSha256:'f'.repeat(64),persistAfterClaim:()=>{},submitOnce:fn=>fn()});await assert.rejects(submitReviewedSandbox(d),/PREFLIGHT_REQUIRED/);assert.deepEqual(d.calls,[]);
});
test('transport cannot retry provider call or fabricate submission without invoking it',async()=>{
 const c=config();c.preflight=async()=>({manifestSha256:c.review.manifestSha256,persistAfterClaim:store=>store.storePrepared(),submitOnce:async fn=>{await fn();return fn();}});
 await assert.rejects(submitReviewedSandbox(c),/OUTCOME_UNKNOWN/);assert.equal(c.calls.filter(x=>x==='provider').length,1);assert.ok(c.calls.includes('unknown'));
 const d=config();d.preflight=async()=>({manifestSha256:d.review.manifestSha256,persistAfterClaim:store=>store.storePrepared(),submitOnce:async()=>({id:'fabricated-id'})});
 await assert.rejects(submitReviewedSandbox(d),/OUTCOME_UNKNOWN/);assert.equal(d.calls.filter(x=>x==='provider').length,0);
 const e=config();e.approval={...e.approval};await assert.rejects(submitReviewedSandbox(e),/APPROVAL_REQUIRED/);assert.deepEqual(e.calls,[]);
});
test('deferred callbacks cannot execute after transport failure; expiry is checked inside provider boundary',async()=>{
 const c=config();let deferred;
 c.preflight=async()=>({manifestSha256:c.review.manifestSha256,persistAfterClaim:store=>store.storePrepared(),submitOnce:async fn=>{deferred=fn;return {id:'fabricated-id'};}});
 await assert.rejects(submitReviewedSandbox(c),/OUTCOME_UNKNOWN/);
 assert.throws(()=>deferred(),/ALREADY_INVOKED/);assert.equal(c.calls.filter(x=>x==='provider').length,0);
 const d=config();let clock=1000;d.now=()=>clock;
 d.preflight=async()=>({manifestSha256:d.review.manifestSha256,persistAfterClaim:store=>store.storePrepared(),submitOnce:fn=>{clock=2001;return fn();}});
 await assert.rejects(submitReviewedSandbox(d),/OUTCOME_UNKNOWN/);assert.equal(d.calls.filter(x=>x==='provider').length,0);
});
