import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {handleSandboxExecution} from './sandbox-execution-handler.mjs';
const approval='e30.'+'b'.repeat(64);
let sequence=0;
function authorized(){
 const token=createHash('sha256').update(String(++sequence)).digest('hex');
 return {token,env:{ARCHON_SANDBOX_EXECUTION_ENABLED:'true',ARCHON_SANDBOX_EXECUTION_EXPIRES_AT:String(Date.now()+600000),ARCHON_SANDBOX_EXECUTION_TOKEN_SHA256:createHash('sha256').update(token).digest('hex')}};
}
const request=(token,body={approvalToken:approval})=>new Request('https://example.test/execute',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('disabled, expired, and unauthorized requests never reach governed execution',async()=>{
 for(const edit of [e=>e.ARCHON_SANDBOX_EXECUTION_ENABLED='false',e=>e.ARCHON_SANDBOX_EXECUTION_EXPIRES_AT='0',e=>e.ARCHON_SANDBOX_EXECUTION_TOKEN_SHA256='f'.repeat(64)]){
  const {token,env}=authorized();edit(env);let calls=0;
  const response=await handleSandboxExecution(request(token),{env,execute:async()=>{calls++;}});
  assert.equal(response.status,403);assert.equal(calls,0);
 }
});
test('only the exact approval-token request reaches execution and operator token is one attempt',async()=>{
 const {token,env}=authorized();let calls=0;
 const injected=await handleSandboxExecution(request(token,{approvalToken:approval,activityId:'attacker'}),{env,execute:async()=>{calls++;}});
 assert.equal(injected.status,400);assert.equal(calls,0);
 const result=await handleSandboxExecution(request(token),{env,execute:async value=>{calls++;assert.equal(value,approval);return {state:'SANDBOX_SUBMITTED',executionEnabled:false};}});
 assert.equal(result.status,200);assert.equal(calls,1);
 const retry=await handleSandboxExecution(request(token),{env,execute:async()=>{calls++;}});
 assert.equal(retry.status,409);assert.equal(calls,1);
});
test('internal errors and secrets are redacted',async()=>{
 const {token,env}=authorized();
 const response=await handleSandboxExecution(request(token),{env,execute:async()=>{throw Error('postgres://secret');}});
 assert.equal(response.status,502);assert.deepEqual(await response.json(),{error:'SANDBOX_EXECUTION_FAILED',executionEnabled:false});
});
