import {createHash,timingSafeEqual} from 'node:crypto';
import {createValidatorActivityPlan} from './prepare-validator-activity.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex'),hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
export function prepareValidatorWorkitem({artifactEvidence,namespace,downloadUrl,reportUploadUrl}={}){
 if(artifactEvidence?.stage!=='ARTIFACTS_VALIDATED'||artifactEvidence.nativeDwgReopenVerified!==false||artifactEvidence.approvalGranted!==false||!id(artifactEvidence.runId)||!id(artifactEvidence.workitemId)||!hex(artifactEvidence.manifestSha256)||!hex(artifactEvidence.dwgSha256)||!hex(artifactEvidence.reportSha256))throw Error('SANDBOX_VALIDATOR_EVIDENCE_INVALID');
 const safe=(value,kind)=>{let url;try{url=new URL(value);}catch{throw Error('SANDBOX_VALIDATOR_URL_INVALID');}if(url.protocol!=='https:'||url.username||url.password||!/(^|\.)s3([.-][a-z0-9-]+)?\.amazonaws\.com$/.test(url.hostname))throw Error('SANDBOX_VALIDATOR_URL_INVALID');return {url:url.href,verb:kind};};
 const plan=createValidatorActivityPlan(namespace);
 return Object.freeze({schemaVersion:1,runId:artifactEvidence.runId,manifestSha256:artifactEvidence.manifestSha256,parentWorkitemId:artifactEvidence.workitemId,inputDwgSha256:artifactEvidence.dwgSha256,activityId:plan.activityId,
  arguments:{inputDwg:safe(downloadUrl,'get'),reopenReport:safe(reportUploadUrl,'put')},executionEnabled:false,approvalGranted:false,reconciliation:'PROPOSE_CHANGESET_ONLY'});
}
export async function submitValidatorWorkitem({workitem,operatorToken,env=process.env,submit}={}){
 const now=Date.now(),expires=Number(env.ARCHON_SANDBOX_VALIDATOR_EXPIRES_AT),expected=env.ARCHON_SANDBOX_VALIDATOR_TOKEN_SHA256;
 if(env.ARCHON_SANDBOX_VALIDATOR_ENABLED!=='true'||!Number.isFinite(expires)||expires<=now||expires>now+31*60000)throw Error('SANDBOX_VALIDATOR_DISABLED');
 if(typeof operatorToken!=='string'||!/^[a-f0-9]{64}$/.test(operatorToken)||!hex(expected)||!timingSafeEqual(Buffer.from(hash(operatorToken),'hex'),Buffer.from(expected,'hex')))throw Error('SANDBOX_VALIDATOR_UNAUTHORIZED');
 if(!workitem||workitem.executionEnabled!==false||workitem.approvalGranted!==false||typeof submit!=='function')throw Error('SANDBOX_VALIDATOR_SUBMISSION_INVALID');
 const result=await submit({...workitem,executionEnabled:true});
 if(!id(result?.workitemId))throw Error('SANDBOX_VALIDATOR_SUBMISSION_UNKNOWN');
 return Object.freeze({state:'VALIDATOR_WORKITEM_SUBMITTED',validatorWorkitemId:result.workitemId,runId:workitem.runId,executionEnabled:false,approvalGranted:false,reconciliation:'NONE'});
}
export function validateNativeReopenReport({bytes,artifactEvidence,currentVersionId}={}){
 if(!Buffer.isBuffer(bytes)||bytes.length<2||bytes.length>1024*1024||artifactEvidence?.stage!=='ARTIFACTS_VALIDATED'||artifactEvidence.nativeDwgReopenVerified!==false||artifactEvidence.approvalGranted!==false)throw Error('SANDBOX_REOPEN_REPORT_INVALID');
 let value;try{value=JSON.parse(bytes.toString('utf8'));}catch{throw Error('SANDBOX_REOPEN_REPORT_INVALID');}
 if(value?.schemaVersion!==1||!Number.isInteger(value.entityCount)||value.entityCount<1||value.sourceVersionId!==currentVersionId||value.nativeDwgReopenVerified!==true||value.reconciliation!=='PROPOSE_CHANGESET_ONLY'||value.governanceAuthority!=='NONE'||value.approvalGranted!==false||!Array.isArray(value.checklist)||value.checklist.some(x=>!['PASS','PENDING'].includes(x?.status)))throw Error('SANDBOX_REOPEN_REPORT_INVALID');
 return Object.freeze({stage:'NATIVE_REOPEN_VERIFIED',reportSha256:hash(bytes),entityCount:value.entityCount,nativeDwgReopenVerified:true,reconciliation:'PROPOSE_CHANGESET_ONLY',approvalGranted:false,checklist:value.checklist});
}
export async function storeNativeReopenEvidence({reviewStore,artifactEvidence,validatorWorkitemId,reportBytes,currentVersionId}={}){
 if(!reviewStore||typeof reviewStore.store!=='function'||!id(validatorWorkitemId))throw Error('SANDBOX_REOPEN_EVIDENCE_STORE_REQUIRED');
 const review=validateNativeReopenReport({bytes:reportBytes,artifactEvidence,currentVersionId});
 await reviewStore.store({runId:artifactEvidence.runId,manifestSha256:artifactEvidence.manifestSha256,workitemId:validatorWorkitemId,stage:review.stage,dwgSha256:artifactEvidence.dwgSha256,reportSha256:review.reportSha256,nativeDwgReopenVerified:true,reconciliation:'PROPOSE_CHANGESET_ONLY',approvalGranted:false,checklist:review.checklist});
 return Object.freeze({...review,runId:artifactEvidence.runId,validatorWorkitemId,governanceAuthority:'NONE'});
}
