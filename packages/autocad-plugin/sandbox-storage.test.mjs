import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareSandboxStorage} from './sandbox-storage.mjs';

const input=Buffer.from('{"testingOnly":true}'),client='test-client';
const bucket='archon_sandbox_'+createHash('sha256').update(client).digest('hex').slice(0,24);
const args={input,env:{APS_CLIENT_ID:client,APS_CLIENT_SECRET:'secret'},runId:'sandbox-test'};
function mock({foreign=false,existing=false,unsafe=false,corrupt=false,uploadFail=false}={}) {
  const calls=[];let created=false;
  const fetcher=async(url,options)=>{
    calls.push({url,...options});const path=new URL(url).pathname,method=options.method??'GET';
    const response=(body,status=200)=>new Response(JSON.stringify(body),{status});
    if(path.endsWith('/token')) return response({access_token:'private-token'});
    if(path.endsWith('/buckets')&&method==='POST') {created=true;return response({});}
    if(path.endsWith('/details')&&!path.includes('/objects/')) return created?response({bucketKey:bucket,bucketOwner:foreign?'another-app':client,policyKey:'transient'}):response({},404);
    if(path.endsWith('/details')&&path.includes('/objects/')) return calls.some(c=>c.method==='POST'&&c.url.endsWith('/signeds3upload'))?response({size:input.length}):response({},existing?200:404);
    if(path.endsWith('/signeds3upload')&&method==='GET') return response({uploadKey:'private-upload-key',urls:[unsafe?'http://127.0.0.1/upload':'https://bucket.s3.amazonaws.com/upload?secret=signature']});
    if(path.endsWith('/signeds3upload')&&method==='POST') return response({});
    if(path.endsWith('/signeds3download')) return response({status:'complete',url:'https://bucket.s3.amazonaws.com/download?secret=signature'});
    if(url.includes('s3.amazonaws.com')) {assert.equal(options.headers,undefined);return method==='PUT'?response({},uploadFail?403:200):new Response(corrupt?'tampered':input);}
    throw Error('unexpected request');
  };return {calls,fetcher};
}
test('sandbox upload/finalize/download verifies exact bytes without leaking signed URLs or tokens',async()=>{
  const m=mock(),r=await prepareSandboxStorage({...args,fetcher:m.fetcher});
  assert.equal(r.state,'SANDBOX_STORAGE_VERIFIED');assert.equal(r.executionEnabled,false);assert.equal(r.seedDwgReady,false);
  assert.ok(!JSON.stringify(r).includes('private-'));assert.ok(!JSON.stringify(r).includes('signature'));
  assert.ok(m.calls.every(c=>!c.url.includes('workitems')));
});
test('ownership and existing-object guard stop before upload signing',async()=>{
  for(const options of [{foreign:true},{existing:true}]) {const m=mock(options);await assert.rejects(prepareSandboxStorage({...args,fetcher:m.fetcher}));assert.ok(!m.calls.some(c=>c.url.includes('signeds3upload')));}
});
test('unsafe signed URLs and failed PUT never finalize',async()=>{
  for(const options of [{unsafe:true},{uploadFail:true}]) {const m=mock(options);await assert.rejects(prepareSandboxStorage({...args,fetcher:m.fetcher}));assert.ok(!m.calls.some(c=>c.method==='POST'&&c.url.endsWith('signeds3upload')));}
});
test('tampered download fails the digest check',async()=>{
  const m=mock({corrupt:true});await assert.rejects(prepareSandboxStorage({...args,fetcher:m.fetcher}),/DIGEST_MISMATCH/);
});
