import {createPinnedSandboxReview} from './sandbox-review.mjs';
import {sandboxInput} from './sandbox-fixture.mjs';
import {verifySandboxApproval} from './sandbox-approval.mjs';
import {submitReviewedSandbox} from './sandbox-submission.mjs';
import {prepareSandboxTransportSession,submitApsWorkitem} from './sandbox-transport.mjs';
export async function executeGovernedSandbox({approvalToken,env=process.env,fetcher=fetch,withStores,now=Date.now,prepareTransport=prepareSandboxTransportSession,submitWorkitem=submitApsWorkitem}={}){
 if(env.ARCHON_SANDBOX_EXECUTION_ENABLED!=='true')throw Error('SANDBOX_EXECUTION_DISABLED');
 const review=createPinnedSandboxReview(env),runId=review.manifest.runId;
 const approval=verifySandboxApproval({token:approvalToken,secret:env.ARCHON_SANDBOX_APPROVAL_KEY,runId,manifestSha256:review.manifestSha256,now});
 if(typeof withStores!=='function')throw Error('SANDBOX_DATABASE_REQUIRED');
 return withStores(async({ledger,receiptStore})=>submitReviewedSandbox({review,inputBytes:Buffer.from(sandboxInput),approval,ledger,receiptStore,executionEnabled:true,now,
  preflight:()=>prepareTransport({env,fetcher,now,inspectRun:async id=>{const row=await ledger.lookup(id);return {ledgerReady:true,runId:id,state:row?.state??'UNCLAIMED'};}}),
  submit:payload=>submitWorkitem({payload,env,fetcher,executionEnabled:true})
 }));
}
