import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareSandboxTransportPreview,prepareSandboxTransportSession,submitApsWorkitem} from './sandbox-transport.mjs';
const client='client',namespace='test',activityId=namespace+'.ArchonGenerateLayout+v0_1';
const env={APS_CLIENT_ID:client,APS_CLIENT_SECRET:'private-secret',APS_ACTIVITY_ID:activityId,ARCHON_SANDBOX_RECEIPT_KEY:'6'.repeat(64)};
const review={state:'SANDBOX_SUBMISSION_REVIEW_PREPARED',manifestSha256:'11c7ecb2277e21f44365fd23cc0b301c22a60925e3df72b39f0f19e900763d8f',runUnclaimed:true,executionEnabled:false,manifest:{resources:{activityId}}};
function setup(edit=()=>{}){
 const calls=[],state={input:0};
 const fetcher=async(url,options={})=>{calls.push({url,options});const path=new URL(url).pathname;
  if(path.endsWith('/token'))return Response.json({access_token:'private-token'});
  if(path.endsWith('/details'))return Response.json({bucketKey:'archon_sandbox_'+createHash('sha256').update(client).digest('hex').slice(0,24),bucketOwner:client,policyKey:'transient'});
  if(path.includes('/signeds3download'))return Response.json({status:'complete',url:'https://bucket.s3.amazonaws.com/private-input-'+(++state.input)});
  throw Error('unexpected request');};
 const outputs={outputDwg:{url:'https://bucket.s3.amazonaws.com/private-output-1',verb:'put'},report:{url:'https://bucket.s3.amazonaws.com/private-output-2',verb:'put'}};edit({state,outputs});
 const receipt={schemaVersion:1,runId:'archon-layout-smoke-20260912-v1',bucketKey:'archon_sandbox_'+createHash('sha256').update(client).digest('hex').slice(0,24),outputs:Object.entries(outputs).map(([argument])=>({argument,key:'archon-layout-smoke-20260912-v1/'+(argument==='outputDwg'?'archon-output.dwg':'archon-report.json'),uploadKey:'private-upload-'+argument})),expiresAt:'1970-01-01T00:10:00.000Z'};
 let bound;
 const reserveOutputs=async()=>({workitemArguments:()=>outputs,exportFinalizationReceipt:()=>receipt,bindWorkitem:id=>{bound=id;},summary:()=>({bucketKey:receipt.bucketKey,capabilityExpiresAt:receipt.expiresAt})});
 return {calls,fetcher,reserveOutputs,get bound(){return bound;}};
}
test('fresh four-argument transport preview is redacted and deliberately non-executable',async()=>{
 const s=setup(),result=await prepareSandboxTransportPreview({env,fetcher:s.fetcher,reserveOutputs:s.reserveOutputs,reviewCheck:async()=>review,now:()=>0});
 const summary=result.summary,serialized=JSON.stringify(result);
 assert.equal(summary.state,'SANDBOX_TRANSPORT_PREVIEW_VERIFIED');assert.equal(summary.inputCapabilities,2);assert.equal(summary.outputCapabilities,2);assert.equal(summary.submissionReady,false);assert.equal(summary.executionEnabled,false);assert.equal(summary.durableFinalizationReceipt,false);
 assert.equal(summary.encryptedReceiptRoundTripVerified,true);
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
test('private session persists encrypted receipt before exactly one provider call',async()=>{
 const s=setup(),session=await prepareSandboxTransportSession({env,fetcher:s.fetcher,reserveOutputs:s.reserveOutputs,reviewCheck:async()=>review,now:()=>0});
 assert.ok(!JSON.stringify(session).includes('private-'));await assert.rejects(session.submitOnce(async()=>({id:'workitem-1'})),/NOT_SUBMITTABLE/);
 let stored,payload;const store={async storePrepared(value){stored=value;}};
 await session.persistAfterClaim(store);assert.equal(stored.state,'PREPARED');assert.ok(!JSON.stringify(stored).includes('private-upload'));
 const result=await session.submitOnce(async value=>{payload=value;return {id:'workitem-1'};});
 assert.equal(result.id,'workitem-1');assert.equal(s.bound,'workitem-1');assert.deepEqual(Object.fromEntries(Object.entries(payload.arguments).map(([k,v])=>[k,v.verb])),{seedDwg:'get',inputJson:'get',outputDwg:'put',report:'put'});
 await assert.rejects(session.submitOnce(async()=>({id:'workitem-2'})),/NOT_SUBMITTABLE/);
});
test('failed receipt persistence prevents provider invocation',async()=>{
 const s=setup(),session=await prepareSandboxTransportSession({env,fetcher:s.fetcher,reserveOutputs:s.reserveOutputs,reviewCheck:async()=>review,now:()=>0});let calls=0;
 await assert.rejects(session.persistAfterClaim({storePrepared:async()=>{throw Error('private-db');}}));
 await assert.rejects(session.persistAfterClaim({storePrepared:async()=>{calls++;}}),/PERSISTENCE_REQUIRED/);
 await assert.rejects(session.submitOnce(async()=>{calls++;return {id:'workitem-1'};}),/NOT_SUBMITTABLE/);assert.equal(calls,0);
});
test('APS workitem submitter is disabled by default and validates exact envelope before one POST',async()=>{
 const payload={activityId,arguments:{seedDwg:{url:'https://bucket.s3.amazonaws.com/seed',verb:'get'},inputJson:{url:'https://bucket.s3.amazonaws.com/input',verb:'get'},outputDwg:{url:'https://bucket.s3.amazonaws.com/output',verb:'put'},report:{url:'https://bucket.s3.amazonaws.com/report',verb:'put'}}};let calls=[];
 const fetcher=async(url,options)=>{calls.push({url,options});return url.endsWith('/token')?Response.json({access_token:'private-token'}):Response.json({id:'workitem-1'});};
 await assert.rejects(submitApsWorkitem({payload,env,fetcher}),/EXECUTION_DISABLED/);assert.equal(calls.length,0);
 for(const bad of [{...payload,activityId:'other'},{...payload,arguments:{...payload.arguments,report:{url:'https://evil.example/x',verb:'put'}}},{...payload,arguments:{...payload.arguments,extra:{url:'https://bucket.s3.amazonaws.com/x',verb:'get'}}}]){await assert.rejects(submitApsWorkitem({payload:bad,env,fetcher,executionEnabled:true}));assert.equal(calls.length,0);}
 const result=await submitApsWorkitem({payload,env,fetcher,executionEnabled:true});assert.equal(result.id,'workitem-1');assert.equal(calls.filter(c=>c.url.endsWith('/workitems')).length,1);
});
