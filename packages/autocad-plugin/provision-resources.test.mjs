import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {provision} from './provision-resources.mjs';

const zip=Buffer.from([0x50,0x4b,0x03,0x04,1]);
const sha256=createHash('sha256').update(zip).digest('hex');
const args={namespace:'archon_test',zip,sha256,env:{APS_CLIENT_ID:'test',APS_CLIENT_SECRET:'test'}};
function mock({existing=false,wrongNamespace=false,uploadFail=false,aliasMismatch=false}={}) {
  const calls=[];
  let spec;
  const fetcher=async(url,options)=>{
    calls.push({url,method:options.method??'GET',body:options.body,headers:options.headers});
    const path=new URL(url).pathname,method=options.method??'GET';
    const response=(value,status=200)=>new Response(JSON.stringify(value),{status});
    if(path.endsWith('/token')) return response({access_token:'private-test-token'});
    if(path.endsWith('/forgeapps/me')) return response(wrongNamespace?'other_app':'archon_test');
    if(path.includes('/engines/')) return response({});
    if(method==='GET'&&/\/(appbundles\/ArchonLayoutBundle|activities\/ArchonGenerateLayout)\/aliases$/.test(path)) return response({},existing?200:404);
    if(method==='POST'&&path.endsWith('/appbundles')) return response({version:7,uploadParameters:{endpointURL:'https://bucket.s3.amazonaws.com/upload',formData:{key:'test'}}});
    if(url.includes('s3.amazonaws.com')) {assert.equal(options.headers,undefined);assert.ok(options.body instanceof FormData);return response({},uploadFail?403:201);}
    if(method==='POST'&&path.endsWith('/activities')) {spec=JSON.parse(options.body);return response({version:11});}
    if(path.includes('/aliases/')&&method==='GET') return response({version:aliasMismatch?999:path.includes('/appbundles/')?7:11});
    if(path.endsWith('/aliases')&&method==='POST') return response({});
    if(method==='GET'&&path.includes('/activities/archon_test.')) return response(spec);
    throw Error('Unexpected request '+method+' '+url);
  };
  return {calls,fetcher};
}
test('dry-run performs no network requests and needs no secrets',async()=>{
  const result=await provision({...args,env:{},fetcher:()=>{throw Error('network');}});
  assert.equal(result.state,'DRY_RUN');assert.equal(result.executionEnabled,false);
});
test('invalid digest rejects before OAuth',async()=>{
  await assert.rejects(provision({...args,sha256:'a'.repeat(64),apply:true,fetcher:()=>{throw Error('network');}}),/SHA256/);
});
test('actual resource versions are aliased; token stays off S3 and report; no workitems',async()=>{
  const m=mock(),result=await provision({...args,apply:true,fetcher:m.fetcher});
  assert.equal(result.appBundleVersion,7);assert.equal(result.activityVersion,11);
  assert.equal(result.executionEnabled,false);assert.equal(result.state,'RESOURCES_VERIFIED');
  assert.ok(!JSON.stringify(result).includes('private-test-token'));
  assert.ok(m.calls.every(c=>!c.url.includes('workitems')&&!['PATCH','DELETE','PUT'].includes(c.method)));
  assert.deepEqual(m.calls.filter(c=>c.method==='POST'&&c.url.endsWith('/aliases')).map(c=>JSON.parse(c.body).version),[7,11]);
});
test('existing resources and namespace mismatch stop before writes',async()=>{
  for(const option of [{existing:true},{wrongNamespace:true}]) {
    const m=mock(option);await assert.rejects(provision({...args,apply:true,fetcher:m.fetcher}));
    assert.ok(m.calls.filter(c=>!c.url.endsWith('/token')).every(c=>c.method==='GET'));
  }
});
test('failed upload creates no alias or activity; alias mismatch stops activity creation',async()=>{
  for(const option of [{uploadFail:true},{aliasMismatch:true}]) {
    const m=mock(option);await assert.rejects(provision({...args,apply:true,fetcher:m.fetcher}));
    assert.ok(!m.calls.some(c=>c.method==='POST'&&c.url.endsWith('/activities')));
    if(option.uploadFail) assert.ok(!m.calls.some(c=>c.method==='POST'&&c.url.endsWith('/aliases')));
  }
});
