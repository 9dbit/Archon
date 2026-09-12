import test from 'node:test';
import assert from 'node:assert/strict';
import {probeSandboxResources} from './sandbox-resources.mjs';
const namespace='test',appBundleId='test.ArchonLayoutBundle+v0_1',activityId='test.ArchonGenerateLayout+v0_1',engine='Autodesk.AutoCAD+25_1';
const env={APS_CLIENT_ID:'client',APS_CLIENT_SECRET:'private-secret',APS_ACTIVITY_ID:activityId,APS_APPBUNDLE_ID:appBundleId,APS_AUTOCAD_ENGINE:engine};
function mock(edit=()=>{}) {
 const calls=[],activity={engine,appbundles:[appBundleId],commandLine:['"$(engine.path)\\accoreconsole.exe" /i "$(args[seedDwg].path)" /al "$(appbundles[ArchonLayoutBundle].path)" /s "$(settings[script].path)"'],settings:{script:{value:'ARCHONLAYOUT\n'}},parameters:Object.fromEntries(Object.entries({seedDwg:['get','seed.dwg'],inputJson:['get','archon-input.json'],outputDwg:['put','archon-output.dwg'],report:['put','archon-report.json']}).map(([key,[verb,localName]])=>[key,{verb,localName,required:true,zip:false,ondemand:false}]))};edit(activity);
 return {calls,fetcher:async(url,options)=>{calls.push({url,...options});const path=new URL(url).pathname;
 const json=value=>new Response(JSON.stringify(value));
 if(path.endsWith('/token'))return json({access_token:'private-token'});
 if(path.endsWith('/forgeapps/me'))return json(namespace);
 if(path.endsWith('/aliases/v0_1'))return json({version:1});
 if(path.includes('/appbundles/'))return json({engine,package:'private-download-url'});
 if(path.includes('/activities/'))return json(activity);
 throw Error('unexpected request');}};
}
test('live resource probe checks exact contract without writes, job calls or exposing tokens',async()=>{
 const m=mock(),r=await probeSandboxResources({env,fetcher:m.fetcher});assert.equal(r.state,'SANDBOX_APS_RESOURCE_SPEC_VERIFIED');assert.equal(r.executionEnabled,false);assert.equal(r.bundleBytesReverified,false);assert.ok(!JSON.stringify(r).includes('private'));
 assert.ok(!m.calls.some(c=>c.url.includes('workitems')));assert.equal(m.calls.filter(c=>c.method==='POST').length,1);
});
test('changed command, parameters, foreign config and resource alias versions fail closed',async()=>{
 for(const edit of [a=>a.commandLine=['malicious command'],a=>a.parameters.seedDwg.verb='put',a=>a.parameters.report.ondemand=true]){const m=mock(edit);await assert.rejects(probeSandboxResources({env,fetcher:m.fetcher}),/MISMATCH/);}
 await assert.rejects(probeSandboxResources({env:{...env,APS_ACTIVITY_ID:'foreign.Activity+alias'},fetcher:mock().fetcher}),/CONFIG_MISMATCH/);
 const m=mock();const versionFetch=(url,o)=>url.includes('/aliases/')?Promise.resolve(new Response(JSON.stringify({version:2}))):m.fetcher(url,o);await assert.rejects(probeSandboxResources({env,fetcher:versionFetch}),/VERSION_MISMATCH/);
});
test('Autodesk omitted false defaults are accepted without allowing malformed flags or missing required fields',async()=>{
 const sparse=mock(a=>{for(const p of Object.values(a.parameters)){delete p.zip;delete p.ondemand;}});
 assert.equal((await probeSandboxResources({env,fetcher:sparse.fetcher})).executionEnabled,false);
 for(const field of ['zip','ondemand'])for(const value of [true,null,'false',0,{},[]]){
  const m=mock(a=>a.parameters.report[field]=value);
  await assert.rejects(probeSandboxResources({env,fetcher:m.fetcher}),/PARAMETER_MISMATCH/);
 }
 for(const edit of [a=>delete a.parameters.report.required,a=>delete a.parameters.report,a=>a.parameters.extra={}]){
  const m=mock(edit);await assert.rejects(probeSandboxResources({env,fetcher:m.fetcher}),/PARAMETER_MISMATCH/);
 }
});
