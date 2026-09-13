import {createPinnedSandboxReview} from './sandbox-review.mjs';
import {sandboxInput} from './sandbox-fixture.mjs';
import {openSandboxReceipt} from './sandbox-receipt.mjs';
import {finalizeSandboxArtifactsFromReceipt} from './output-transport.mjs';
const host='https://developer.api.autodesk.com';
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
export async function inspectApsWorkitem({workitemId,env=process.env,fetcher=fetch}={}){
 if(!validId(workitemId)||!env.APS_CLIENT_ID?.trim()||!env.APS_CLIENT_SECRET?.trim())throw Error('SANDBOX_LIFECYCLE_CONFIGURATION_INVALID');
 const request=async(url,options={})=>{try{return await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(30000)});}catch{throw Error('SANDBOX_LIFECYCLE_REQUEST_FAILED');}};
 const auth=await request(host+'/authentication/v2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:'Basic '+Buffer.from(env.APS_CLIENT_ID+':'+env.APS_CLIENT_SECRET).toString('base64')},body:new URLSearchParams({grant_type:'client_credentials',scope:'code:all'}).toString()});
 if(!auth.ok)throw Error('SANDBOX_LIFECYCLE_AUTH_HTTP_'+auth.status);
 let access;try{access=(await auth.json()).access_token;}catch{throw Error('SANDBOX_LIFECYCLE_AUTH_INVALID');}
 if(typeof access!=='string'||!access)throw Error('SANDBOX_LIFECYCLE_AUTH_INVALID');
 const response=await request(host+'/da/us-east/v3/workitems/'+encodeURIComponent(workitemId),{headers:{Authorization:'Bearer '+access}});
 if(!response.ok)throw Error('SANDBOX_LIFECYCLE_HTTP_'+response.status);
 let value;try{value=await response.json();}catch{throw Error('SANDBOX_LIFECYCLE_RESPONSE_INVALID');}
 if(value?.id!==workitemId||!['pending','inprogress','success','failed','cancelled'].includes(value.status))throw Error('SANDBOX_LIFECYCLE_RESPONSE_INVALID');
 return Object.freeze({state:value.status==='success'?'APS_WORKITEM_SUCCEEDED':['failed','cancelled'].includes(value.status)?'APS_WORKITEM_TERMINAL_FAILURE':'APS_WORKITEM_PENDING',workitemId,status:value.status,providerReportAvailable:typeof value.reportUrl==='string',executionEnabled:false,approvalGranted:false});
}
const record=row=>({schemaVersion:1,runId:row.run_id,manifestSha256:row.manifest_sha256,ciphertext:row.ciphertext,iv:row.iv,authTag:row.auth_tag,expiresAt:new Date(row.expires_at).toISOString(),state:'PREPARED'});
export async function finalizeGovernedSandbox({env=process.env,fetcher=fetch,withStores,currentVersionId,inspectWorkitem=inspectApsWorkitem,finalizeArtifacts=finalizeSandboxArtifactsFromReceipt,now=Date.now}={}){
 if(env.ARCHON_SANDBOX_FINALIZATION_ENABLED!=='true')throw Error('SANDBOX_FINALIZATION_DISABLED');
 if(typeof withStores!=='function'||typeof finalizeArtifacts!=='function'||typeof currentVersionId!=='string'||!currentVersionId)throw Error('SANDBOX_FINALIZATION_CONFIGURATION_INVALID');
 const review=createPinnedSandboxReview(env),runId=review.manifest.runId;
 return withStores(async({ledger,receiptStore})=>{
  const submission=await ledger.lookup(runId);
  if(submission?.state!=='SUBMITTED'||submission.manifest_sha256!==review.manifestSha256||!validId(submission.workitem_id))throw Error('SANDBOX_SUBMITTED_RUN_REQUIRED');
  const lifecycle=await inspectWorkitem({workitemId:submission.workitem_id,env,fetcher});
  if(lifecycle.state==='APS_WORKITEM_PENDING')return {...lifecycle,runId,manifestSha256:review.manifestSha256,reconciliation:'NONE'};
  if(lifecycle.state!=='APS_WORKITEM_SUCCEEDED')throw Error('SANDBOX_WORKITEM_NOT_SUCCESSFUL');
  const claimed=await receiptStore.claimFinalization(runId,review.manifestSha256,submission.workitem_id);
  try{
   const receipt=openSandboxReceipt({record:record(claimed),runId,manifestSha256:review.manifestSha256,secret:env.ARCHON_SANDBOX_RECEIPT_KEY,now});
   const result=await finalizeArtifacts({receipt,workitemId:submission.workitem_id,inputBytes:Buffer.from(sandboxInput),currentVersionId,env,fetcher});
   if(result?.state!=='ARTIFACTS_REQUIRE_ARCHON_REVIEW'||result.approvalGranted!==false||result.reconciliation!=='PROPOSE_CHANGESET_ONLY')throw Error('SANDBOX_FINALIZATION_RESULT_INVALID');
   await receiptStore.markConsumed(runId);
   return {...result,runId,manifestSha256:review.manifestSha256,workitemId:submission.workitem_id,executionEnabled:false,approvalGranted:false};
  }catch{try{await receiptStore.markUnknown(runId);}catch{}throw Error('SANDBOX_OUTPUT_FINALIZATION_UNKNOWN');}
 });
}
