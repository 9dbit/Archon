import test from 'node:test';
import assert from 'node:assert/strict';
import {sealSandboxReceipt,openSandboxReceipt} from './sandbox-receipt.mjs';
const runId='archon-layout-smoke-20260912-v1',manifestSha256='1'.repeat(64),secret='2'.repeat(64),now=()=>1000;
const receipt={schemaVersion:1,runId,bucketKey:'archon_sandbox_'+'3'.repeat(24),outputs:[{argument:'outputDwg',key:runId+'/archon-output.dwg',uploadKey:'private-upload-key-dwg'},{argument:'report',key:runId+'/archon-report.json',uploadKey:'private-upload-key-report'}],expiresAt:new Date(601000).toISOString()};
test('AES-GCM receipt round-trip binds exact run and manifest without plaintext secrets',()=>{
 const sealed=sealSandboxReceipt({receipt,runId,manifestSha256,secret,now});
 assert.equal(sealed.state,'PREPARED');assert.ok(!JSON.stringify(sealed).includes('private-upload'));
 const opened=openSandboxReceipt({record:sealed,runId,manifestSha256,secret,now});
 assert.equal(opened.runId,runId);assert.deepEqual(opened.outputs,receipt.outputs);
});
test('wrong key, run, manifest, tag, ciphertext, expiry and malformed output keys fail closed',()=>{
 const sealed=sealSandboxReceipt({receipt,runId,manifestSha256,secret,now});
 for(const change of [{secret:'4'.repeat(64)},{runId:'other-run'},{manifestSha256:'5'.repeat(64)},{record:{...sealed,authTag:'0'.repeat(32)}},{record:{...sealed,ciphertext:sealed.ciphertext.slice(0,-2)+'AA'}},{now:()=>601000}])assert.throws(()=>openSandboxReceipt({record:sealed,runId,manifestSha256,secret,now,...change}),/SANDBOX_RECEIPT_/);
 for(const edit of [r=>r.outputs[0].key='other/output.dwg',r=>r.outputs[1].argument='outputDwg',r=>r.outputs[0].uploadKey='',r=>r.expiresAt=new Date(1000).toISOString()]){const bad=structuredClone(receipt);edit(bad);assert.throws(()=>sealSandboxReceipt({receipt:bad,runId,manifestSha256,secret,now}),/SANDBOX_RECEIPT_/);}
});
