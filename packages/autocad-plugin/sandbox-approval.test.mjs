import test from 'node:test';
import assert from 'node:assert/strict';
import {issueSandboxApproval,verifySandboxApproval,isVerifiedSandboxApproval} from './sandbox-approval.mjs';
const secret='a'.repeat(64),runId='test-run',manifestSha256='b'.repeat(64);
const config={secret,runId,manifestSha256,now:()=>1000};
const issue=()=>issueSandboxApproval({...config,reference:'test-human-decision',expiresAt:2000});
test('signed grant is bound to exact run, manifest and deadline; plain objects and copies carry no authority',()=>{
 const approval=verifySandboxApproval({...config,token:issue()});
 assert.equal(isVerifiedSandboxApproval(approval),true);assert.equal(Object.isFrozen(approval),true);
 assert.equal(isVerifiedSandboxApproval({...approval}),false);assert.equal(isVerifiedSandboxApproval({}),false);
 for(const change of [{secret:'c'.repeat(64)},{runId:'another-run'},{manifestSha256:'d'.repeat(64)},{now:()=>2000},{now:()=>999}])assert.throws(()=>verifySandboxApproval({...config,...change,token:issue()}),/APPROVAL_REQUIRED/);
});
test('tampered payload/signature, malformed tokens and excessive lifetime fail closed',()=>{
 const token=issue(),[payload,signature]=token.split('.');
 const modified=JSON.parse(Buffer.from(payload,'base64url'));modified.runId='another-run';
 for(const value of [undefined,'',token+'x',Buffer.from(JSON.stringify(modified)).toString('base64url')+'.'+signature,payload+'.'+'0'.repeat(64),'x'.repeat(2049)])assert.throws(()=>verifySandboxApproval({...config,token:value}));
 assert.throws(()=>issueSandboxApproval({...config,reference:'test',expiresAt:3601001}),/APPROVAL_INVALID/);
 assert.throws(()=>issueSandboxApproval({...config,reference:'test',expiresAt:2000,secret:''}),/KEY_REQUIRED/);
});
