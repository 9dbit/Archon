import {prepareSandboxSubmissionReview} from './sandbox-review.mjs';
import {issueSandboxApproval} from './sandbox-approval.mjs';
export async function issueReviewedSandboxApproval({env=process.env,fetcher=fetch,inspectRun,reviewCheck=prepareSandboxSubmissionReview,now=Date.now}={}){
 const current=now(),gate=Number(env.ARCHON_SANDBOX_APPROVAL_ISSUANCE_EXPIRES_AT),reference=env.ARCHON_SANDBOX_APPROVAL_REFERENCE;
 if(env.ARCHON_SANDBOX_APPROVAL_ISSUANCE_ENABLED!=='true'||!Number.isFinite(gate)||gate<=current||gate>current+31*60000||typeof reference!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(reference))throw Error('SANDBOX_APPROVAL_ISSUANCE_DISABLED');
 const review=await reviewCheck({env,fetcher,inspectRun,now});
 if(review?.state!=='SANDBOX_SUBMISSION_REVIEW_PREPARED'||review.executionEnabled!==false||review.approvalGranted!==false||review.runUnclaimed!==true)throw Error('SANDBOX_APPROVAL_REVIEW_REQUIRED');
 const expiresAt=Math.min(gate,current+10*60000);
 const approvalToken=issueSandboxApproval({runId:review.manifest.runId,manifestSha256:review.manifestSha256,reference,expiresAt,secret:env.ARCHON_SANDBOX_APPROVAL_KEY,now});
 return {state:'SANDBOX_EXECUTION_APPROVAL_ISSUED',runId:review.manifest.runId,manifestSha256:review.manifestSha256,reference,expiresAt,approvalToken,executionEnabled:false,approvalGranted:true};
}
