import {createHash} from 'node:crypto';
import {prepareSandboxSubmissionReview} from './sandbox-review.mjs';
import {reserveSandboxOutputs} from './output-transport.mjs';
import {sealSandboxReceipt,openSandboxReceipt} from './sandbox-receipt.mjs';

const host='https://developer.api.autodesk.com';
const runId='archon-layout-smoke-20260912-v1';
const inputs={seedDwg:'archon-seed-c935e19c89274600/seed.dwg',inputJson:runId+'/archon-input.json'};
const safeUrl=value=>{
 let url;try{url=new URL(value);}catch{throw Error('SANDBOX_TRANSPORT_URL_INVALID');}
 if(url.protocol!=='https:'||url.username||url.password||!/(^|\.)s3([.-][a-z0-9-]+)?\.amazonaws\.com$/.test(url.hostname))throw Error('SANDBOX_TRANSPORT_URL_INVALID');
 return url.href;
};
async function prepareCapabilities({env,fetcher,inspectRun,reviewCheck,reserveOutputs,now}){
 const review=await reviewCheck({env,fetcher,inspectRun,now});
 if(review?.state!=='SANDBOX_SUBMISSION_REVIEW_PREPARED'||review.manifestSha256!=='11c7ecb2277e21f44365fd23cc0b301c22a60925e3df72b39f0f19e900763d8f'||review.runUnclaimed!==true||review.executionEnabled!==false)throw Error('SANDBOX_TRANSPORT_REVIEW_REQUIRED');
 const request=async(url,options={})=>{try{return await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(30000)});}catch{throw Error('SANDBOX_TRANSPORT_REQUEST_FAILED');}};
 const parse=async response=>{if(!response.ok)throw Error('SANDBOX_TRANSPORT_HTTP_'+response.status);try{return await response.json();}catch{throw Error('SANDBOX_TRANSPORT_RESPONSE_INVALID');}};
 const auth=await parse(await request(host+'/authentication/v2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:'Basic '+Buffer.from(env.APS_CLIENT_ID+':'+env.APS_CLIENT_SECRET).toString('base64')},body:new URLSearchParams({grant_type:'client_credentials',scope:'bucket:read data:read'}).toString()}));
 if(typeof auth.access_token!=='string'||!auth.access_token.trim())throw Error('SANDBOX_TRANSPORT_TOKEN_INVALID');
 const bucket='archon_sandbox_'+createHash('sha256').update(env.APS_CLIENT_ID).digest('hex').slice(0,24),base=host+'/oss/v2/buckets/'+bucket;
 const get=path=>request(base+path,{headers:{Authorization:'Bearer '+auth.access_token}});
 const owner=await parse(await get('/details'));
 if(owner.bucketKey!==bucket||owner.bucketOwner!==env.APS_CLIENT_ID||owner.policyKey!=='transient')throw Error('SANDBOX_TRANSPORT_BUCKET_MISMATCH');
 const args={};
 for(const [argument,key] of Object.entries(inputs)){
  const signed=await parse(await get('/objects/'+encodeURIComponent(key)+'/signeds3download?minutesExpiration=10'));
  if(signed.status!=='complete')throw Error('SANDBOX_TRANSPORT_INPUT_UNAVAILABLE');
  args[argument]={url:safeUrl(signed.url),verb:'get'};
 }
 const outputSession=await reserveOutputs({env,fetcher,runId,now});
 const outputs=outputSession.workitemArguments();
 if(Object.keys(outputs).sort().join(',')!=='outputDwg,report'||Object.values(outputs).some(a=>a?.verb!=='put'))throw Error('SANDBOX_TRANSPORT_OUTPUT_INVALID');
 for(const [name,value] of Object.entries(outputs))args[name]={url:safeUrl(value.url),verb:'put'};
 if(Object.keys(args).sort().join(',')!=='inputJson,outputDwg,report,seedDwg'||new Set(Object.values(args).map(a=>a.url)).size!==4)throw Error('SANDBOX_TRANSPORT_ARGUMENTS_INVALID');
 const activityId=review.manifest?.resources?.activityId;
 if(activityId!==env.APS_ACTIVITY_ID)throw Error('SANDBOX_TRANSPORT_ACTIVITY_MISMATCH');
 const outputSummary=outputSession.summary(),started=now();
 const receipt=outputSession.exportFinalizationReceipt(review.manifestSha256);
 const sealed=sealSandboxReceipt({receipt,runId,manifestSha256:review.manifestSha256,secret:env.ARCHON_SANDBOX_RECEIPT_KEY,now});
 const opened=openSandboxReceipt({record:sealed,runId,manifestSha256:review.manifestSha256,secret:env.ARCHON_SANDBOX_RECEIPT_KEY,now});
 if(opened.outputs?.length!==2||opened.bucketKey!==outputSummary.bucketKey)throw Error('SANDBOX_TRANSPORT_RECEIPT_ROUNDTRIP_FAILED');
 const capabilityDeadline=new Date(Math.min(started+8*60000,Date.parse(outputSummary.capabilityExpiresAt)-60000)).toISOString();
 return {review,args,activityId,outputSession,sealed,capabilityDeadline};
}
// Read-only operator probe: fresh secrets are round-tripped, discarded and never persisted.
export async function prepareSandboxTransportPreview({env=process.env,fetcher=fetch,inspectRun,reviewCheck=prepareSandboxSubmissionReview,reserveOutputs=reserveSandboxOutputs,now=Date.now}={}){
 const {review,activityId,capabilityDeadline}=await prepareCapabilities({env,fetcher,inspectRun,reviewCheck,reserveOutputs,now});
 const summary=Object.freeze({state:'SANDBOX_TRANSPORT_PREVIEW_VERIFIED',runId,manifestSha256:review.manifestSha256,activityId,inputCapabilities:2,outputCapabilities:2,argumentContract:{seedDwg:'get',inputJson:'get',outputDwg:'put',report:'put'},capabilityDeadline,urlsExposed:false,encryptedReceiptRoundTripVerified:true,durableFinalizationReceipt:false,submissionReady:false,executionEnabled:false,approvalGranted:false,pending:['PERSIST_ENCRYPTED_RECEIPT_AFTER_APPROVAL_AND_LEDGER_CLAIM','EXPLICIT_SANDBOX_EXECUTION_APPROVAL','POST_JOB_NATIVE_DWG_AND_ARCHON_REVIEW']});
 return Object.freeze({summary,toJSON:()=>summary});
}

// Private preflight for submitReviewedSandbox. It cannot call the provider until the encrypted
// receipt has been durably inserted for the already-SUBMITTING ledger row.
export async function prepareSandboxTransportSession({env=process.env,fetcher=fetch,inspectRun,reviewCheck=prepareSandboxSubmissionReview,reserveOutputs=reserveSandboxOutputs,now=Date.now}={}){
 const {review,args,activityId,outputSession,sealed,capabilityDeadline}=await prepareCapabilities({env,fetcher,inspectRun,reviewCheck,reserveOutputs,now});
 let state='UNPERSISTED',invoked=false;
 const summary=()=>({state:'SANDBOX_PRIVATE_TRANSPORT_SESSION',runId,manifestSha256:review.manifestSha256,activityId,capabilityDeadline,receiptState:state,urlsExposed:false,executionEnabled:false,approvalGranted:false});
 return Object.freeze({manifestSha256:review.manifestSha256,summary,toJSON:summary,
  async persistAfterClaim(receiptStore){
   if(state!=='UNPERSISTED'||typeof receiptStore?.storePrepared!=='function')throw Error('SANDBOX_TRANSPORT_PERSISTENCE_REQUIRED');
   state='PERSISTING';try{await receiptStore.storePrepared(sealed);state='PERSISTED';return {state:'SANDBOX_RECEIPT_PERSISTED',runId,manifestSha256:review.manifestSha256,secretsRedacted:true};}catch{state='UNKNOWN';throw Error('SANDBOX_TRANSPORT_PERSISTENCE_UNKNOWN');}
  },
  async submitOnce(submit){
   if(state!=='PERSISTED'||invoked||typeof submit!=='function'||now()>=Date.parse(capabilityDeadline))throw Error('SANDBOX_TRANSPORT_NOT_SUBMITTABLE');
   invoked=true;state='SUBMITTING';
   try{const result=await submit({activityId,arguments:args});if(typeof result?.id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(result.id))throw Error('SANDBOX_WORKITEM_INVALID');outputSession.bindWorkitem(result.id);state='SUBMITTED';return {id:result.id};}
   catch{state='UNKNOWN';throw Error('SANDBOX_TRANSPORT_OUTCOME_UNKNOWN');}
  }
 });
}

export async function submitApsWorkitem({payload,env=process.env,fetcher=fetch,executionEnabled=false}={}){
 if(executionEnabled!==true)throw Error('SANDBOX_EXECUTION_DISABLED');
 if(payload?.activityId!==env.APS_ACTIVITY_ID||Object.keys(payload.arguments??{}).sort().join(',')!=='inputJson,outputDwg,report,seedDwg')throw Error('SANDBOX_WORKITEM_PAYLOAD_INVALID');
 const verbs={seedDwg:'get',inputJson:'get',outputDwg:'put',report:'put'};
 for(const [name,verb] of Object.entries(verbs)){const value=payload.arguments[name];if(value?.verb!==verb||Object.keys(value).sort().join(',')!=='url,verb')throw Error('SANDBOX_WORKITEM_PAYLOAD_INVALID');safeUrl(value.url);}
 const request=async(url,options={})=>{try{return await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(30000)});}catch{throw Error('SANDBOX_WORKITEM_REQUEST_FAILED');}};
 const auth=await request(host+'/authentication/v2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:'Basic '+Buffer.from(env.APS_CLIENT_ID+':'+env.APS_CLIENT_SECRET).toString('base64')},body:new URLSearchParams({grant_type:'client_credentials',scope:'code:all'}).toString()});
 if(!auth.ok)throw Error('SANDBOX_WORKITEM_AUTH_HTTP_'+auth.status);let token;try{token=(await auth.json()).access_token;}catch{throw Error('SANDBOX_WORKITEM_AUTH_INVALID');}if(typeof token!=='string'||!token)throw Error('SANDBOX_WORKITEM_AUTH_INVALID');
 const response=await request(host+'/da/us-east/v3/workitems',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload)});
 if(!response.ok)throw Error('SANDBOX_WORKITEM_HTTP_'+response.status);let result;try{result=await response.json();}catch{throw Error('SANDBOX_WORKITEM_RESPONSE_INVALID');}
 if(typeof result?.id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(result.id))throw Error('SANDBOX_WORKITEM_INVALID');return {id:result.id};
}
