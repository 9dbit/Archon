import test from 'node:test';
import assert from 'node:assert/strict';
import {createPinnedSandboxReview,prepareSandboxSubmissionReview} from './sandbox-review.mjs';
const namespace='kGcY7aMipAtRf8kS0SulmGsoiIU1E1HiGc5X40rkeE8twyps';
const env={APS_ACTIVITY_ID:namespace+'.ArchonGenerateLayout+v0_1',APS_APPBUNDLE_ID:namespace+'.ArchonLayoutBundle+v0_1',APS_AUTOCAD_ENGINE:'Autodesk.AutoCAD+25_1'};
const runId='archon-layout-smoke-20260912-v1';
const status=()=>({runId,bundleBytesReverified:true,outputsAbsent:true,executionEnabled:false,checks:['seed','input'].map(artifact=>({artifact,status:'VERIFIED',bytesVerified:true}))});
test('pinned review retains previously reviewed digest and grants no approval or execution',async()=>{
 assert.equal(createPinnedSandboxReview(env).manifestSha256,'11c7ecb2277e21f44365fd23cc0b301c22a60925e3df72b39f0f19e900763d8f');
 const result=await prepareSandboxSubmissionReview({env,inspectRun:async()=>({ledgerReady:true,runId,state:'UNCLAIMED'}),probe:async()=>status(),now:()=>1000});
 assert.equal(result.executionEnabled,false);assert.equal(result.approvalGranted,false);assert.equal(result.runUnclaimed,true);
});
test('claimed run blocks preflight; missing bytes and occupied output destinations block review',async()=>{
 let probes=0;
 for(const state of ['CLAIMED','SUBMITTING','SUBMITTED','UNKNOWN'])await assert.rejects(prepareSandboxSubmissionReview({env,inspectRun:async()=>({ledgerReady:true,runId,state}),probe:async()=>{probes++;return status();}}),/RUN_UNAVAILABLE/);
 assert.equal(probes,0);
 for(const edit of [s=>s.checks[1].bytesVerified=false,s=>s.outputsAbsent=false,s=>s.bundleBytesReverified=false,s=>s.runId='other-run']){
  const s=status();edit(s);await assert.rejects(prepareSandboxSubmissionReview({env,inspectRun:async()=>({ledgerReady:true,runId,state:'UNCLAIMED'}),probe:async()=>s}),/PREFLIGHT_REQUIRED/);
 }
});
