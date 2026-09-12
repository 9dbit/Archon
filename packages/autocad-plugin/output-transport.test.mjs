import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {reserveSandboxOutputs,validateOutputReport} from './output-transport.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const input={schemaVersion:1,units:'mm',source:{projectId:'test-only',versionId:'v1',mode:'PREVIEW',level:'Ground Floor',changeSetId:'test-preview'},entities:[{kind:'TEXT',sourceId:'room',revision:1,layer:'ARCHON_ROOMS',positionMm:[0,0],text:'Kitchen'}]};
const inputBytes=Buffer.from(JSON.stringify(input));
const report={schemaVersion:1,source:input.source,units:'mm',coordinateMapping:'ARCHON_XZ_TO_CAD_XY',inputSha256:hash(inputBytes),outputFile:'archon-output.dwg',reconciliation:'PROPOSE_CHANGESET_ONLY',governanceAuthority:'NONE',entities:[{inputIndex:0,sourceId:'room',revision:1,kind:'TEXT',handle:'1A',layer:'ARCHON_ROOMS',geometry:{positionMm:[0,0],text:'Kitchen'}}]};
const reportBytes=Buffer.from(JSON.stringify(report)),dwg=Buffer.concat([Buffer.from('AC1032'),Buffer.alloc(100)]);
const client='test-client',bucket='archon_sandbox_'+hash(Buffer.from(client)).slice(0,24);
function mock({existing=false,foreign=false,badDwg=false}={}) {
  const calls=[];let finalized=new Set();
  const fetcher=async(url,options)=>{
    calls.push({url,...options});const path=new URL(url).pathname,method=options.method??'GET';
    const r=(value,status=200)=>new Response(JSON.stringify(value),{status});
    if(path.endsWith('/token')) return r({access_token:'private-token'});
    if(path.endsWith('/details')&&!path.includes('/objects/')) return r({bucketKey:bucket,bucketOwner:foreign?'foreign':client,policyKey:'transient'});
    const kind=path.includes('archon-output.dwg')?'dwg':'report';
    if(path.endsWith('/details')) return finalized.has(kind)?r({size:kind==='dwg'?dwg.length:reportBytes.length}):r({},existing?200:404);
    if(path.endsWith('/signeds3upload')&&method==='POST') {finalized.add(kind);return r({});}
    if(path.endsWith('/signeds3upload')) return r({urls:['https://bucket.s3.amazonaws.com/upload?signature=private'],uploadKey:'private-key'});
    if(path.endsWith('/signeds3download')) return r({status:'complete',url:'https://bucket.s3.amazonaws.com/'+kind+'?signature=private'});
    if(url.includes('s3.amazonaws.com')) {assert.equal(options.headers,undefined);return new Response(url.includes('/dwg')?(badDwg?Buffer.alloc(dwg.length):dwg):reportBytes);}
    throw Error('Unexpected request');
  };return {calls,fetcher};
}
const args={env:{APS_CLIENT_ID:client,APS_CLIENT_SECRET:'secret'},runId:'output-test'};
test('reservation serializes without capability secrets and performs no workitem/PUT/completion',async()=>{
  const m=mock(),session=await reserveSandboxOutputs({...args,fetcher:m.fetcher});
  assert.ok(!JSON.stringify(session).includes('private'));assert.equal(session.summary().executionEnabled,false);
  assert.equal(session.workitemArguments().outputDwg.verb,'put');
  assert.ok(!m.calls.some(c=>c.url.includes('workitems')||c.method==='PUT'||c.method==='POST'&&c.url.endsWith('signeds3upload')));
});
test('foreign bucket/existing outputs fail before any signed upload request',async()=>{
  for(const option of [{foreign:true},{existing:true}]) {const m=mock(option);await assert.rejects(reserveSandboxOutputs({...args,fetcher:m.fetcher}));assert.ok(!m.calls.some(c=>c.url.includes('signeds3upload')));}
});
test('expiration and unrelated/failed job forbid capability use or finalization',async()=>{
  let clock=0;const m=mock(),session=await reserveSandboxOutputs({...args,fetcher:m.fetcher,now:()=>clock});
  session.bindWorkitem('job-1');
  for(const evidence of [{workitemId:'other',status:'success'},{workitemId:'job-1',status:'failed'}]) await assert.rejects(session.finalizeAfterSuccess({...evidence,inputBytes,currentVersionId:'v1'}),/SUCCESS_REQUIRED/);
  clock=9*60000;assert.throws(()=>session.workitemArguments(),/EXPIRED/);
  assert.ok(!m.calls.some(c=>c.method==='POST'&&c.url.endsWith('signeds3upload')));
});
test('mock successful upload completion/download remains pending native reopen and ARCHON approval',async()=>{
  const m=mock(),session=await reserveSandboxOutputs({...args,fetcher:m.fetcher});session.bindWorkitem('job-1');
  const result=await session.finalizeAfterSuccess({workitemId:'job-1',status:'success',inputBytes,currentVersionId:'v1'});
  assert.equal(result.state,'ARTIFACTS_REQUIRE_ARCHON_REVIEW');assert.equal(result.approvalGranted,false);assert.equal(result.nativeDwgReopenVerified,false);
  assert.equal(result.review.state,'REPORT_MATCHES_PREPARED_INPUT');assert.ok(!JSON.stringify(result).includes('private'));
  await assert.rejects(session.finalizeAfterSuccess({workitemId:'job-1',status:'success',inputBytes,currentVersionId:'v1'}));
});
test('invalid DWG signature fails after completion and grants no artifact approval',async()=>{
  const m=mock({badDwg:true}),session=await reserveSandboxOutputs({...args,fetcher:m.fetcher});session.bindWorkitem('job-1');
  await assert.rejects(session.finalizeAfterSuccess({workitemId:'job-1',status:'success',inputBytes,currentVersionId:'v1'}),/DWG_HEADER_INVALID/);assert.equal(session.summary().state,'FAILED');
});
test('report rejects stale version, changed geometry/identity, duplicate index and forged input digest',()=>{
  assert.throws(()=>validateOutputReport({inputBytes,reportBytes,currentVersionId:'v2'}),/STALE/);
  for(const edit of [r=>r.entities[0].geometry.positionMm[0]=500,r=>r.entities[0].revision=2,r=>r.inputSha256='a'.repeat(64),r=>r.entities[0].inputIndex=99]) {const r=structuredClone(report);edit(r);assert.throws(()=>validateOutputReport({inputBytes,reportBytes:Buffer.from(JSON.stringify(r)),currentVersionId:'v1'}));}
});

test('polyline and native dimension evidence must match coordinates and finite measurements',()=>{
  const expected=structuredClone(input);
  expected.entities=[
    {kind:'POLYLINE',sourceId:'site',revision:1,layer:'ARCHON_SITE',pointsMm:[[0,0],[10000,0],[10000,8000],[0,8000]],closed:true},
    {kind:'DIMENSION',sourceId:'site',revision:1,layer:'ARCHON_DIMS',startMm:[0,0],endMm:[10000,0],axis:'X',measuredMm:10000}
  ];
  const bytes=Buffer.from(JSON.stringify(expected));
  const evidence=structuredClone(report);evidence.inputSha256=hash(bytes);
  evidence.entities=expected.entities.map((e,i)=>({inputIndex:i,sourceId:e.sourceId,revision:e.revision,kind:e.kind,handle:(20+i).toString(16),layer:e.layer,geometry:e.kind==='POLYLINE'?{closed:true,pointsMm:e.pointsMm}:{startMm:e.startMm,endMm:e.endMm,measuredMm:e.measuredMm}}));
  assert.equal(validateOutputReport({inputBytes:bytes,reportBytes:Buffer.from(JSON.stringify(evidence)),currentVersionId:'v1'}).entityCount,2);
  for(const edit of [r=>r.entities[0].geometry.closed=false,r=>r.entities[0].geometry.pointsMm[1][0]=10500,r=>r.entities[1].geometry.measuredMm=9999,r=>r.entities[1].inputIndex=0,r=>r.entities[1].handle=r.entities[0].handle]) {
    const changed=structuredClone(evidence);edit(changed);
    assert.throws(()=>validateOutputReport({inputBytes:bytes,reportBytes:Buffer.from(JSON.stringify(changed)),currentVersionId:'v1'}));
  }
});
