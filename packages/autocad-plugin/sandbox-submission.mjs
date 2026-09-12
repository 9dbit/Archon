import {createHash} from 'node:crypto';
import {createSandboxManifest} from './sandbox-manifest.mjs';
import {isVerifiedSandboxApproval} from './sandbox-approval.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
// Private server boundary only. There is intentionally no HTTP route or enabled runtime caller.
export async function submitReviewedSandbox({review,inputBytes,approval,ledger,receiptStore,preflight,submit,executionEnabled=false,now=Date.now}) {
  if(executionEnabled!==true||typeof preflight!=='function'||typeof submit!=='function') throw Error('SANDBOX_EXECUTION_DISABLED');
  if(!isVerifiedSandboxApproval(approval))throw Error('SANDBOX_EXPLICIT_APPROVAL_REQUIRED');
  const m=review?.manifest?structuredClone(review.manifest):undefined;
  const manifestSha256=review?.manifestSha256;
  const grant=approval?Object.freeze({...approval}):undefined;
  if(!m||!Buffer.isBuffer(inputBytes)) throw Error('SANDBOX_REVIEW_INVALID');
  const canonical=createSandboxManifest({inputBytes,expectedInputSha256:m.inputs?.inputJson?.sha256,runId:m.runId,resources:m.resources,seed:{...m.inputs?.seedDwg,state:'SEED_STORED_IN_SANDBOX',executionEnabled:false}});
  if(manifestSha256!==canonical.manifestSha256||hash(Buffer.from(JSON.stringify(m)))!==canonical.manifestSha256) throw Error('SANDBOX_REVIEW_DIGEST_MISMATCH');
  const approved=()=>{
    if(grant?.manifestSha256!==manifestSha256||grant.runId!==m.runId||typeof grant.reference!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(grant.reference)||!Number.isFinite(grant.expiresAt)||grant.expiresAt<=now()||grant.expiresAt>now()+60*60000) throw Error('SANDBOX_EXPLICIT_APPROVAL_REQUIRED');
  };
  approved();
  if(!ledger||['claim','beginSubmission','markSubmitted','markUnknown'].some(k=>typeof ledger[k]!=='function')) throw Error('SANDBOX_LEDGER_REQUIRED');
  if(!receiptStore||typeof receiptStore.storePrepared!=='function')throw Error('SANDBOX_RECEIPT_STORE_REQUIRED');
  // Preflight must recheck native resources, seed/input integrity, absent output keys and fresh capabilities.
  const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  const session=await preflight(freeze(canonical));
  if(session?.manifestSha256!==manifestSha256||typeof session.persistAfterClaim!=='function'||typeof session.submitOnce!=='function') throw Error('SANDBOX_PREFLIGHT_REQUIRED');
  approved();
  await ledger.claim({runId:m.runId,manifestSha256:manifestSha256,approvalReference:grant.reference});
  await ledger.beginSubmission(m.runId);
  let transportOpen=true;
  try {
    await session.persistAfterClaim(receiptStore);
    approved();
    // Exactly one provider call. The session privately binds transport; no token/URL enters this result.
    let invoked=false;
    const result=await session.submitOnce((...args)=>{
      if(!transportOpen||invoked)throw Error('SANDBOX_PROVIDER_ALREADY_INVOKED');
      approved();
      invoked=true;
      return submit(...args);
    });
    transportOpen=false;
    if(!invoked)throw Error('SANDBOX_PROVIDER_NOT_INVOKED');
    if(typeof result?.id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(result.id)) throw Error('SANDBOX_WORKITEM_INVALID');
    await ledger.markSubmitted(m.runId,result.id);
    return {state:'SANDBOX_WORKITEM_SUBMITTED',runId:m.runId,manifestSha256:manifestSha256,workitemId:result.id,approvalGranted:false,reconciliation:'PROPOSE_CHANGESET_ONLY'};
  } catch {
    // A timeout or failed DB acknowledgement cannot prove the provider did not accept the job.
    await ledger.markUnknown(m.runId).catch(()=>{});
    throw Error('SANDBOX_SUBMISSION_OUTCOME_UNKNOWN');
  }finally{transportOpen=false;}
}
