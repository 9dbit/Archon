import test from 'node:test';
import assert from 'node:assert/strict';
import {issueReviewedSandboxApproval} from './sandbox-approval-issuer.mjs';
import {verifySandboxApproval} from './sandbox-approval.mjs';
const now=()=>1000,secret='a'.repeat(64);
const base={ARCHON_SANDBOX_APPROVAL_ISSUANCE_ENABLED:'true',ARCHON_SANDBOX_APPROVAL_ISSUANCE_EXPIRES_AT:'601000',ARCHON_SANDBOX_APPROVAL_REFERENCE:'human-checkpoint-1',ARCHON_SANDBOX_APPROVAL_KEY:secret};
const review={state:'SANDBOX_SUBMISSION_REVIEW_PREPARED',manifest:{runId:'test-run'},manifestSha256:'b'.repeat(64),runUnclaimed:true,executionEnabled:false,approvalGranted:false};
test('approval issuance is separately disabled by default',async()=>{
 let checks=0;await assert.rejects(issueReviewedSandboxApproval({env:{},now,reviewCheck:async()=>{checks++;return review;}}),/ISSUANCE_DISABLED/);assert.equal(checks,0);
});
test('issuer requires the exact unclaimed reviewed manifest',async()=>{
 for(const edit of [r=>r.runUnclaimed=false,r=>r.executionEnabled=true,r=>r.approvalGranted=true]){
  const candidate=structuredClone(review);edit(candidate);
  await assert.rejects(issueReviewedSandboxApproval({env:base,now,reviewCheck:async()=>candidate}),/REVIEW_REQUIRED/);
 }
});
test('issued approval is short lived and bound to run and manifest',async()=>{
 const result=await issueReviewedSandboxApproval({env:base,now,reviewCheck:async()=>review});
 assert.equal(result.executionEnabled,false);assert.equal(result.approvalGranted,true);assert.equal(result.expiresAt,601000);
 const verified=verifySandboxApproval({token:result.approvalToken,secret,runId:'test-run',manifestSha256:'b'.repeat(64),now});
 assert.equal(verified.reference,'human-checkpoint-1');
 assert.throws(()=>verifySandboxApproval({token:result.approvalToken,secret,runId:'other-run',manifestSha256:'b'.repeat(64),now}),/EXPLICIT_APPROVAL_REQUIRED/);
});
