import {createPinnedSandboxReview} from './sandbox-review.mjs';
import {prepareConcreteValidatorTransport,submitApsValidatorWorkitem} from './sandbox-validator-transport.mjs';

const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);

function validatorNamespace(env){
 const match=env.APS_VALIDATOR_ACTIVITY_ID?.match(/^([A-Za-z0-9_-]+)\.ArchonValidateDrawing\+v0_1$/);
 if(!match)throw Error('SANDBOX_VALIDATOR_ACTIVITY_REQUIRED');
 return match[1];
}

function evidenceObject(row){
 if(!row)throw Error('SANDBOX_VALIDATOR_ARTIFACT_EVIDENCE_REQUIRED');
 const value=typeof row.evidence==='string'?JSON.parse(row.evidence):row.evidence;
 return value&&typeof value==='object'?value:null;
}

function artifactEvidenceFromRow(row,manifestSha256){
 let evidence;try{evidence=evidenceObject(row);}catch{throw Error('SANDBOX_VALIDATOR_ARTIFACT_EVIDENCE_REQUIRED');}
 const record=Object.freeze({schemaVersion:1,evidenceSha256:row.evidence_sha256,runId:row.run_id,manifestSha256:row.manifest_sha256,workitemId:row.workitem_id,stage:row.stage,dwgSha256:row.dwg_sha256,reportSha256:row.report_sha256,nativeDwgReopenVerified:evidence.nativeDwgReopenVerified,reconciliation:evidence.reconciliation,approvalGranted:row.approval_granted,checklist:Array.isArray(evidence.checklist)?evidence.checklist:[]});
 if(record.stage!=='ARTIFACTS_VALIDATED'||record.manifestSha256!==manifestSha256||!id(record.runId)||!id(record.workitemId)||!hex(record.evidenceSha256)||!hex(record.manifestSha256)||!hex(record.dwgSha256)||!hex(record.reportSha256)||record.nativeDwgReopenVerified!==false||record.reconciliation!=='PROPOSE_CHANGESET_ONLY'||record.approvalGranted!==false)throw Error('SANDBOX_VALIDATOR_ARTIFACT_EVIDENCE_REQUIRED');
 return record;
}

function submittedId(row){return row?.validator_workitem_id??row?.validatorWorkitemId;}

export async function executeGovernedSandboxValidator({env=process.env,fetcher=fetch,withStores,now=Date.now,prepareTransport=prepareConcreteValidatorTransport,submitWorkitem=submitApsValidatorWorkitem}={}){
 if(env.ARCHON_SANDBOX_VALIDATOR_TRANSPORT_ENABLED!=='true')throw Error('SANDBOX_VALIDATOR_TRANSPORT_DISABLED');
 if(typeof withStores!=='function'||typeof prepareTransport!=='function'||typeof submitWorkitem!=='function')throw Error('SANDBOX_VALIDATOR_CONFIGURATION_INVALID');
 const review=createPinnedSandboxReview(env),runId=review.manifest.runId,namespace=validatorNamespace(env);
 return withStores(async({reviewStore,validatorLedger,validatorReceiptStore})=>{
  if(!reviewStore||typeof reviewStore.lookup!=='function'||!validatorLedger||['lookup','claim','begin','submitted','unknown'].some(k=>typeof validatorLedger[k]!=='function')||!validatorReceiptStore||typeof validatorReceiptStore.storePrepared!=='function')throw Error('SANDBOX_VALIDATOR_STORES_REQUIRED');
  const existing=await validatorLedger.lookup(runId);
  if(existing?.state==='SUBMITTED'&&existing.manifest_sha256===review.manifestSha256&&id(submittedId(existing)))return {state:'SANDBOX_VALIDATOR_ALREADY_SUBMITTED',runId,manifestSha256:review.manifestSha256,validatorWorkitemId:submittedId(existing),executionEnabled:false,approvalGranted:false,reconciliation:'NONE'};
  if(existing)throw Error('SANDBOX_VALIDATOR_RUN_LOCKED');
  const artifactEvidence=artifactEvidenceFromRow(await reviewStore.lookup(runId,'ARTIFACTS_VALIDATED'),review.manifestSha256);
  const session=await prepareTransport({artifactEvidence,namespace,env,fetcher,now});
  if(session?.summary?.runId!==runId||session.summary.manifestSha256!==review.manifestSha256||session.summary.inputDwgSha256!==artifactEvidence.dwgSha256||session.summary.activityId!==env.APS_VALIDATOR_ACTIVITY_ID||session.summary.executionEnabled!==false||session.summary.approvalGranted!==false||typeof session.persistBeforeSubmit!=='function'||typeof session.submitOnce!=='function')throw Error('SANDBOX_VALIDATOR_TRANSPORT_INVALID');
  await validatorLedger.claim({runId,manifestSha256:review.manifestSha256,artifactEvidenceSha256:artifactEvidence.evidenceSha256,inputDwgSha256:artifactEvidence.dwgSha256,activityId:session.summary.activityId});
  await validatorLedger.begin(runId);
  let transportOpen=true;
  try{
   await session.persistBeforeSubmit(validatorReceiptStore);
   let invoked=false;
   const result=await session.submitOnce(payload=>{
    if(!transportOpen||invoked)throw Error('SANDBOX_VALIDATOR_PROVIDER_ALREADY_INVOKED');
    invoked=true;
    return submitWorkitem({payload,env,fetcher,executionEnabled:true});
   });
   transportOpen=false;
   if(!invoked||!id(result?.id))throw Error('SANDBOX_VALIDATOR_PROVIDER_NOT_INVOKED');
   await validatorLedger.submitted(runId,result.id);
   return {state:'SANDBOX_VALIDATOR_WORKITEM_SUBMITTED',runId,manifestSha256:review.manifestSha256,validatorWorkitemId:result.id,executionEnabled:false,approvalGranted:false,reconciliation:'NONE'};
  }catch{
   await validatorLedger.unknown(runId).catch(()=>{});
   throw Error('SANDBOX_VALIDATOR_SUBMISSION_OUTCOME_UNKNOWN');
  }finally{transportOpen=false;}
 });
}
