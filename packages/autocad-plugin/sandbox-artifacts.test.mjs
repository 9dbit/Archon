import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyArtifactResponse} from './sandbox-artifacts.mjs';
import {sandboxInput} from './sandbox-fixture.mjs';
const bytes=Buffer.from('AC1024 synthetic artifact'),spec={size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),header:'AC1024'};
test('stored byte verification requires exact size, digest and DWG header',async()=>{
 assert.equal(await verifyArtifactResponse(new Response(bytes),spec),true);
 for(const [body,change] of [[Buffer.from('AC1024 tampered artifact'),{}],[bytes.subarray(0,10),{}],[Buffer.concat([bytes,Buffer.from('x')]),{}],[bytes,{header:'AC1032'}]]){
  await assert.rejects(verifyArtifactResponse(new Response(body),{...spec,...change}),/SANDBOX_ARTIFACT_/);
 }
 await assert.rejects(verifyArtifactResponse(new Response(bytes,{headers:{'Content-Length':'999'}}),spec),/SIZE_MISMATCH/);
 await assert.rejects(verifyArtifactResponse(new Response('private error',{status:403}),spec),/DOWNLOAD_FAILED/);
});
test('streaming readback bounds bytes across chunks and verifies accumulated digest',async()=>{
 const stream=new ReadableStream({start(c){c.enqueue(bytes.subarray(0,2));c.enqueue(bytes.subarray(2));c.close();}});
 assert.equal(await verifyArtifactResponse(new Response(stream),spec),true);
 const oversized=new ReadableStream({start(c){c.enqueue(bytes);c.enqueue(Buffer.alloc(100));c.close();}});
 await assert.rejects(verifyArtifactResponse(new Response(oversized),spec),/SIZE_MISMATCH/);
});
test('reviewed input is the exact immutable synthetic PREVIEW fixture',()=>{
 assert.equal(sandboxInput.length,2108);
 assert.equal(createHash('sha256').update(sandboxInput).digest('hex'),'70f9fab1673d29d82c71ceb75e56d5b13865900b772ffccc6dd1153baa18b3ff');
 const input=JSON.parse(sandboxInput);assert.equal(input.source.projectId,'test-only');assert.equal(input.source.mode,'PREVIEW');assert.equal(input.executionEnabled,false);assert.equal(input.reconciliation,'PROPOSE_CHANGESET_ONLY');
});
