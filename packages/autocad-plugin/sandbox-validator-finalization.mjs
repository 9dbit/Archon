import {createPinnedSandboxReview} from './sandbox-review.mjs';
import {inspectApsWorkitem,resolvePinnedSandboxSourceVersion} from './sandbox-lifecycle.mjs';
import {openValidatorReceipt} from './sandbox-validator-receipt.mjs';
import {downloadValidatorReopenReportFromReceipt} from './sandbox-validator-output.mjs';
import {storeNativeReopenEvidence} from './sandbox-validator-lifecycle.mjs';

const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
function evidenceObject(row){if(!row)throw Error('SANDBOX_VALIDATOR_ARTIFACT_EVIDENCE_REQUIRED');const value=typeof row.evidence==='string'?JSON.parse(row.evidence):row.evidence;return value&&typeof value==='object'?value:null;}
function artifactEvidenceFromRow(row,manifestSha256){let evidence;try{evidence=evidenceObject(row);}catch{throw Error('SANDBOX_VALIDATOR_ARTIFACT_EVIDENCE_REQUIRED');}const record=Object.freeze({schemaVersion:1,evidenceSha256:row.evidence_sha256,runId:row.run_id,manifestSha256:row.manifest_sha256,workitemId:row.workitem_id,stage:row.stage,dwgSha256:row.dwg_sha256,reportSha256:row.report_sha256,nativeDwgReopenVerified:evidence.nativeDwgReopenVerified,reconciliation:evidence.reconciliation,approvalGranted:row.approval_granted,checklist:Array.isArray(evidence.checklist)?evidence.checklist:[]});if(record.stage!=='ARTIFACTS_VALIDATED'||record.manifestSha256!==manifestSha256||!id(record.runId)||!id(record.workitemId)||!hex(record.evidenceSha256)||!hex(record.manifestSha256)||!hex(record.dwgSha256)||!hex(record.reportSha256)||record.nativeDwgReopenVerified!==false||record.reconciliation!=='PROPOSE_CHANGESET_ONLY'||record.approvalGranted!==false)throw Error('SANDBOX_VALIDATOR_ARTIFACT_EVIDENCE_REQUIRED');return record;}
const record=row=>({schemaVersion:1,runId:row.run_id,manifestSha256:row.manifest_sha256,artifactEvidenceSha256:row.artifact_evidence_sha256,ciphertext:row.ciphertext,iv:row.iv,authTag:row.auth_tag,expiresAt:new Date(row.expires_at).toISOString(),state:'PREPARED'});

export async function finalizeGovernedSandboxValidator({env=process.env,fetcher=fetch,withStores,resolveCurrentVersion=resolvePinnedSandboxSourceVersion,inspectWorkitem=inspectApsWorkitem,finalizeReport=downloadValidatorReopenReportFromReceipt,now=Date.now}={}){
 if(env.ARCHON_SANDBOX_VALIDATOR_FINALIZATION_ENABLED!=='true')throw Error('SANDBOX_VALIDATOR_FINALIZATION_DISABLED');
 if(typeof withStores!=='function'||typeof resolveCurrentVersion!=='function'||typeof inspectWorkitem!=='function'||typeof finalizeReport!=='function')throw Error('SANDBOX_VALIDATOR_FINALIZATION_CONFIGURATION_INVALID');
 const currentVersionId=await resolveCurrentVersion();if(typeof currentVersionId!=='string'||!currentVersionId)throw Error('SANDBOX_SOURCE_VERSION_INVALID');
 const review=createPinnedSandboxReview(env),runId=review.manifest.runId;
 return withStores(async({reviewStore,validatorLedger,validatorReceiptStore})=>{
  if(!reviewStore||['lookup','store'].some(k=>typeof reviewStore[k]!=='function')||!validatorLedger||typeof validatorLedger.lookup!=='function'||!validatorReceiptStore||['claimFinalization','markConsumed','markUnknown'].some(k=>typeof validatorReceiptStore[k]!=='function'))throw Error('SANDBOX_VALIDATOR_FINALIZATION_STORES_REQUIRED');
  const artifactEvidence=artifactEvidenceFromRow(await reviewStore.lookup(runId,'ARTIFACTS_VALIDATED'),review.manifestSha256);
  const submission=await validatorLedger.lookup(runId);
  if(submission?.state!=='SUBMITTED'||submission.manifest_sha256!==review.manifestSha256||submission.artifact_evidence_sha256!==artifactEvidence.evidenceSha256||!id(submission.validator_workitem_id))throw Error('SANDBOX_VALIDATOR_SUBMITTED_RUN_REQUIRED');
  const lifecycle=await inspectWorkitem({workitemId:submission.validator_workitem_id,env,fetcher});
  if(lifecycle.state==='APS_WORKITEM_PENDING')return {...lifecycle,runId,manifestSha256:review.manifestSha256,validatorWorkitemId:submission.validator_workitem_id,reconciliation:'NONE'};
  if(lifecycle.state!=='APS_WORKITEM_SUCCEEDED')throw Error('SANDBOX_VALIDATOR_WORKITEM_NOT_SUCCESSFUL');
  const claimed=await validatorReceiptStore.claimFinalization(runId,review.manifestSha256,artifactEvidence.evidenceSha256,submission.validator_workitem_id);
  try{
   const receipt=openValidatorReceipt({record:record(claimed),secret:env.ARCHON_SANDBOX_VALIDATOR_RECEIPT_KEY,now});
   const result=await finalizeReport({receipt,artifactEvidence,currentVersionId,env,fetcher});
   if(result?.state!=='SANDBOX_VALIDATOR_REOPEN_REPORT_REVIEW_READY'||result.approvalGranted!==false||result.reconciliation!=='PROPOSE_CHANGESET_ONLY'||!Buffer.isBuffer(result.reportBytes))throw Error('SANDBOX_VALIDATOR_REPORT_RESULT_INVALID');
   const evidence=await storeNativeReopenEvidence({reviewStore,artifactEvidence,validatorWorkitemId:submission.validator_workitem_id,reportBytes:result.reportBytes,currentVersionId});
   await validatorReceiptStore.markConsumed(runId);
   return {state:'NATIVE_REOPEN_REQUIRES_ARCHON_REVIEW',runId,manifestSha256:review.manifestSha256,validatorWorkitemId:submission.validator_workitem_id,nativeDwgReopenVerified:true,reportSha256:evidence.reportSha256,reconciliation:'PROPOSE_CHANGESET_ONLY',approvalGranted:false,executionEnabled:false,checklist:evidence.checklist};
  }catch{try{await validatorReceiptStore.markUnknown(runId);}catch{}throw Error('SANDBOX_VALIDATOR_FINALIZATION_UNKNOWN');}
 });
}
