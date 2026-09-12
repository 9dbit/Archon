import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSandboxTransportPreview} from './sandbox-transport.mjs';
const client='client',namespace='test',activityId=namespace+'.ArchonGenerateLayout+v0_1';
const env={APS_CLIENT_ID:client,APS_CLIENT_SECRET:'private-secret',APS_ACTIVITY_ID:activityId};
const review={state:'SANDBOX_SUBMISSION_REVIEW_PREPARED',manifestSha256:'11c7ecb2277e21f44365fd23cc0b301c22a60925e3df72b39f0f19e900763d8f',runUnclaimed:true,executionEnabled:false,manifest:{resources:{activityId}}};
function setup(edit=()=>{}){
 const calls=[],state={input:0};
 const fetcher=async(url,options={})=>{calls.push({url,options});const path=new URL(url).pathname;
  if(path.endsWith('/token'))return Response.json({access_token:'private-token'});
  if(path.endsWith('/details'))return Response.json({bucketKey:'archon_sandbox_'+(await import('node:crypto')).createHash('sha256').update(client).digest('hex').slice(0,24),bucketOwner:client,policyKey:'transient'});
  if(path.includes('/signeds3download'))return Response.json({status:'complete',url:'https://bucket.s3.amazonaws.com/private-input-'+(++state.input)});
  throw Error('unexpected request');};
 const outputs={outputDwg:{url:'https://bucket.s3.amazonaws.com/private-output-1',verb:'put'},report:{url:'https://bucket.s3.amazonaws.com/private-output-2',verb:'put'}};edit({state,outputs});
 const reserveOutputs=async()=>({workitemArguments:()=>outputs,summary:()=>({capabilityExpiresAt:'1970-01-01T00:10:00.000Z'})});
 return {calls,fetcher,reserveOutputs};
}
test('fresh four-argument transport preview is redacted and deliberately non-executable',async()=>{
 const s=setup(),result=await prepareSandboxTransportPreview({env,fetcher:s.fetcher,reserveOutputs:s.reserveOutputs,reviewCheck:async()=>review,now:()=>0});
 const summary=result.summary,serialized=JSON.stringify(result);
 assert.equal(summary.state,'SANDBOX_TRANSPORT_PREVIEW_VERIFIED');assert.equal(summary.inputCapabilities,2);assert.equal(summary.outputCapabilities,2);assert.equal(summary.submissionReady,false);assert.equal(summary.executionEnabled,false);assert.equal(summary.durableFinalizationReceipt,false);
 assert.equal(result.submitOnce,undefined);assert.ok(!serialized.includes('private-'));assert.ok(!serialized.includes('token'));assert.equal(s.calls.filter(c=>c.options.method==='POST').length,1);
});
test('unsafe, duplicate, malformed or incorrectly bound capabilities fail closed',async()=>{
 const unsafe=setup();let count=0;unsafe.fetcher=async(url,o)=>url.includes('signeds3download')?Response.json({status:'complete',url:++count===1?'https://evil.example/input':'https://bucket.s3.amazonaws.com/input'}):setup().fetcher(url,o);
 await assert.rejects(prepareSandboxTransportPreview({env,fetcher:unsafe.fetcher,reserveOutputs:unsafe.reserveOutputs,reviewCheck:async()=>review,now:()=>0}),/URL_INVALID/);
 for(const edit of [x=>x.outputs.report.url=x.outputs.outputDwg.url,x=>x.outputs.report.verb='get',x=>delete x.outputs.report]){
  const s=setup(edit);await assert.rejects(prepareSandboxTransportPreview({env,fetcher:s.fetcher,reserveOutputs:s.reserveOutputs,reviewCheck:async()=>review,now:()=>0}),/TRANSPORT_/);
 }
 const mismatched=setup();
 await assert.rejects(prepareSandboxTransportPreview({env:{...env,APS_ACTIVITY_ID:'other.Activity+v0_1'},fetcher:mismatched.fetcher,reserveOutputs:mismatched.reserveOutputs,reviewCheck:async()=>review,now:()=>0}),/ACTIVITY_MISMATCH/);
});
test('claimed or unverified review blocks before requesting any capability',async()=>{
 const s=setup();for(const change of [{runUnclaimed:false},{manifestSha256:'0'.repeat(64)},{executionEnabled:true}]){
  await assert.rejects(prepareSandboxTransportPreview({env,fetcher:s.fetcher,reserveOutputs:s.reserveOutputs,reviewCheck:async()=>({...review,...change}),now:()=>0}),/REVIEW_REQUIRED/);
 }
 assert.equal(s.calls.length,0);
});
