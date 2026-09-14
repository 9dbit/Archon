import test from 'node:test';import assert from 'node:assert/strict';import {provisionValidatorActivity} from './provision-validator-activity.mjs';
const env={APS_CLIENT_ID:'client',APS_CLIENT_SECRET:'secret'};
function mock({existing=false,wrongNamespace=false,aliasMismatch=false,readbackMismatch=false}={}){
 const calls=[];let spec;
 const fetcher=async(url,options={})=>{calls.push({url,method:options.method??'GET',body:options.body,headers:options.headers});const path=new URL(url).pathname,method=options.method??'GET',response=(value,status=200)=>new Response(JSON.stringify(value),{status});
  if(path.endsWith('/token'))return response({access_token:'private-token'});
  if(path.endsWith('/forgeapps/me'))return response(wrongNamespace?'other':'owner');
  if(path.includes('/engines/'))return response({});
  if(path.endsWith('/appbundles/ArchonLayoutBundle/aliases/v0_1'))return response({version:7});
  if(method==='GET'&&path.endsWith('/activities/ArchonValidateDrawing/aliases'))return response({},existing?200:404);
  if(method==='POST'&&path.endsWith('/activities')){spec=JSON.parse(options.body);return response({version:11});}
  if(method==='POST'&&path.endsWith('/activities/ArchonValidateDrawing/aliases'))return response({});
  if(method==='GET'&&path.endsWith('/activities/ArchonValidateDrawing/aliases/v0_1'))return response({version:aliasMismatch?99:11});
  if(method==='GET'&&path.includes('/activities/owner.ArchonValidateDrawing'))return response({...spec,engine:readbackMismatch?'wrong':spec.engine});
  throw Error('unexpected '+method+' '+url);
 };
 return {calls,fetcher};
}
test('validator activity dry run is deterministic and performs no network',async()=>{let calls=0;const result=await provisionValidatorActivity({namespace:'owner',fetcher:async()=>calls++});assert.equal(result.state,'VALIDATOR_ACTIVITY_DRY_RUN');assert.equal(result.activityId,'owner.ArchonValidateDrawing+v0_1');assert.equal(result.executionEnabled,false);assert.equal(calls,0);});
test('validator activity apply creates only the activity alias and redacts tokens',async()=>{const m=mock(),result=await provisionValidatorActivity({namespace:'owner',apply:true,env,fetcher:m.fetcher});assert.equal(result.state,'VALIDATOR_ACTIVITY_VERIFIED');assert.equal(result.railway.APS_VALIDATOR_ACTIVITY_ID,'owner.ArchonValidateDrawing+v0_1');assert.ok(!JSON.stringify(result).includes('private-token'));assert.ok(m.calls.every(c=>!c.url.includes('/workitems')&&!['PATCH','DELETE','PUT'].includes(c.method)));assert.equal(m.calls.filter(c=>c.method==='POST'&&c.url.endsWith('/activities')).length,1);});
test('existing activity, namespace mismatch and readback mismatch fail before unsafe continuation',async()=>{for(const option of [{existing:true},{wrongNamespace:true},{aliasMismatch:true},{readbackMismatch:true}]){const m=mock(option);await assert.rejects(provisionValidatorActivity({namespace:'owner',apply:true,env,fetcher:m.fetcher}));if(option.existing||option.wrongNamespace)assert.ok(m.calls.filter(c=>!c.url.endsWith('/token')).every(c=>c.method==='GET'));}});
