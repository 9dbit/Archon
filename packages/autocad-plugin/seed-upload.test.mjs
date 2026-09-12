import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {handleSeedUpload,uploadSeed} from './seed-upload.mjs';

const hash=(value,algorithm='sha256')=>createHash(algorithm).update(value).digest('hex');
const token='a'.repeat(64),bytes=Buffer.concat([Buffer.from('AC1024'),Buffer.alloc(6*1024*1024)]);
const client='test-client',bucket='archon_sandbox_'+hash(client).slice(0,24);
const config=()=>({APS_CLIENT_ID:client,APS_CLIENT_SECRET:'secret',ARCHON_SEED_UPLOAD_ENABLED:'true',ARCHON_SEED_UPLOAD_EXPIRES_AT:String(Date.now()+10*60000),ARCHON_SEED_SHA256:hash(bytes),ARCHON_SEED_BYTES:String(bytes.length),ARCHON_SEED_RUN_ID:randomUUID(),ARCHON_SEED_UPLOAD_TOKEN_SHA256:hash(token)});
const req=(body=bytes,auth=token)=>new Request('https://example.test/api/integrations/autocad/seed',{method:'POST',headers:{Authorization:'Bearer '+auth,'Content-Type':'application/octet-stream','Content-Length':String(body.length)},body});
function mock({foreign=false,existing=false,partFailure=false,integrity=false}={}) {
  const calls=[];let complete=false;
  const fetcher=async(url,options)=>{
    calls.push({url,...options});const path=new URL(url).pathname,method=options.method??'GET';
    const r=(value,status=200)=>new Response(JSON.stringify(value),{status});
    if(path.endsWith('/token')) return r({access_token:'private-token'});
    if(path.endsWith('/details')&&!path.includes('/objects/')) return r({bucketKey:bucket,bucketOwner:foreign?'another-app':client,policyKey:'transient'});
    if(path.endsWith('/details')) return complete?r({size:bytes.length,sha1:integrity?'invalid':hash(bytes,'sha1')}):r({},existing?200:404);
    if(path.endsWith('/signeds3upload')&&method==='POST') {complete=true;return r({});}
    if(path.endsWith('/signeds3upload')) return r({urls:['https://bucket.s3.amazonaws.com/part1?signature=private','https://bucket.s3.amazonaws.com/part2?signature=private'],uploadKey:'private-key'});
    if(url.includes('s3.amazonaws.com')) {assert.equal(options.headers,undefined);return r({},partFailure?403:200);}
    throw Error('Unexpected request');
  };return {calls,fetcher};
}
test('disabled, expired, wrong token and missing scope configuration never read provider or upload',async()=>{
  for(const edit of [e=>e.ARCHON_SEED_UPLOAD_ENABLED='false',e=>e.ARCHON_SEED_UPLOAD_EXPIRES_AT='0',e=>e.ARCHON_SEED_UPLOAD_TOKEN_SHA256='b'.repeat(64),e=>e.ARCHON_SEED_RUN_ID='']) {
    const env=config();edit(env);const r=await handleSeedUpload(req(),env,()=>{throw Error('network must not happen');});assert.notEqual(r.status,200);
  }
});
test('checksum-bound route refuses wrong bytes before OAuth',async()=>{
  const env=config();env.ARCHON_SEED_SHA256='b'.repeat(64);const m=mock();const r=await handleSeedUpload(req(),env,m.fetcher);assert.equal(r.status,400);assert.equal(m.calls.length,0);
});
test('multipart seed upload verifies metadata hash without leaking credentials/capabilities',async()=>{
  const m=mock(),env=config(),r=await handleSeedUpload(req(),env,m.fetcher);assert.equal(r.status,200);
  const result=await r.json();assert.equal(result.sha256,hash(bytes));assert.equal(result.nativeOpenVerified,false);assert.equal(result.executionEnabled,false);
  assert.ok(!JSON.stringify(result).includes('private'));
  const parts=m.calls.filter(c=>c.method==='PUT');assert.deepEqual(parts.map(c=>c.body.length),[5*1024*1024,bytes.length-5*1024*1024]);
  assert.ok(!m.calls.some(c=>c.url.includes('workitems')));
  assert.equal((await handleSeedUpload(req(),env,m.fetcher)).status,409);
});
test('ownership/existing-key guards prevent signing; failed part never finalizes',async()=>{
  for(const option of [{foreign:true},{existing:true},{partFailure:true}]) {const m=mock(option);await assert.rejects(uploadSeed({bytes,runId:'test-run',env:config(),fetcher:m.fetcher}));assert.ok(!m.calls.some(c=>c.method==='POST'&&c.url.endsWith('signeds3upload')));}
});
test('completed object with wrong OSS integrity hash remains rejected',async()=>{
  const m=mock({integrity:true});await assert.rejects(uploadSeed({bytes,runId:'test-run',env:config(),fetcher:m.fetcher}),/INTEGRITY_MISMATCH/);
});
