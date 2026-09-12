import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {handleSandboxOperator} from './sandbox-operator.mjs';
const token='a'.repeat(64),env=()=>({ARCHON_SANDBOX_SETUP_ENABLED:'true',ARCHON_SANDBOX_SETUP_EXPIRES_AT:String(Date.now()+600000),ARCHON_SANDBOX_SETUP_TOKEN_SHA256:createHash('sha256').update(token).digest('hex')});
const req=operation=>new Request('https://example.test/setup',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({operation})});
test('disabled/expired/unauthorized operator cannot reach database or APS',async()=>{
 for(const edit of [e=>e.ARCHON_SANDBOX_SETUP_ENABLED='false',e=>e.ARCHON_SANDBOX_SETUP_EXPIRES_AT='0',e=>e.ARCHON_SANDBOX_SETUP_TOKEN_SHA256='b'.repeat(64)]){const e=env();edit(e);const r=await handleSandboxOperator(req('ACTIVATE_LEDGER'),{env:e,activate:()=>{throw Error('must not run');}});assert.equal(r.status,403);}
});
test('only fixed setup operations dispatch; execution requests and provider secrets are rejected',async()=>{
 let activations=0;const options={env:env(),activate:async()=>{activations++;return {ledgerReady:true,executionEnabled:false};},probe:async()=>{throw Error('private token and postgres URL');}};
 assert.equal((await handleSandboxOperator(req('ACTIVATE_LEDGER'),options)).status,200);assert.equal(activations,1);
 assert.equal((await handleSandboxOperator(req('SUBMIT_WORKITEM'),options)).status,400);
 const failed=await handleSandboxOperator(req('PROBE_RESOURCES'),options);assert.equal(failed.status,502);assert.equal((await failed.json()).error,'SANDBOX_OPERATOR_FAILED');
});
test('artifact probe dispatch remains authenticated and separate from submission',async()=>{
 let count=0;const artifacts=async()=>{count++;return {executionEnabled:false};};
 const result=await handleSandboxOperator(req('PROBE_ARTIFACTS'),{env:env(),artifacts});
 assert.equal(result.status,200);assert.equal(count,1);
 const disabled={...env(),ARCHON_SANDBOX_SETUP_ENABLED:'false'};
 assert.equal((await handleSandboxOperator(req('PROBE_ARTIFACTS'),{env:disabled,artifacts})).status,403);assert.equal(count,1);
});
test('input preparation cannot accept user-supplied geometry or bypass authentication',async()=>{
 let count=0;const prepareInput=async()=>{count++;return {executionEnabled:false};};
 const options={env:env(),prepareInput};
 const arbitrary=new Request('https://example.test/setup',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({operation:'PREPARE_REVIEWED_INPUT',input:{production:true}})});
 assert.equal((await handleSandboxOperator(arbitrary,options)).status,400);assert.equal(count,0);
 assert.equal((await handleSandboxOperator(req('PREPARE_REVIEWED_INPUT'),{...options,env:{}})).status,403);assert.equal(count,0);
 assert.equal((await handleSandboxOperator(req('PREPARE_REVIEWED_INPUT'),options)).status,200);assert.equal(count,1);
});
test('transport probe exposes only its redacted summary and cannot accept a workitem payload',async()=>{
 let count=0;const transport=async()=>({toJSON:()=>({state:'SANDBOX_TRANSPORT_PREVIEW_VERIFIED',executionEnabled:false,urlsExposed:false}),submitOnce:()=>{throw Error('must not serialize');}});
 const options={env:env(),transport};
 const result=await handleSandboxOperator(req('PROBE_TRANSPORT'),options);assert.equal(result.status,200);const body=await result.json();assert.equal(body.urlsExposed,false);assert.equal(body.submitOnce,undefined);
 const injected=new Request('https://example.test/setup',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({operation:'PROBE_TRANSPORT',arguments:{outputDwg:'attacker'}})});
 assert.equal((await handleSandboxOperator(injected,options)).status,400);assert.equal(count,0);
});
