import {createHash} from 'node:crypto';
import {validateNativeReopenReport} from './sandbox-validator-lifecycle.mjs';

const host='https://developer.api.autodesk.com',hash=bytes=>createHash('sha256').update(bytes).digest('hex'),hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const safe=value=>{let url;try{url=new URL(value);}catch{throw Error('SANDBOX_VALIDATOR_REPORT_SIGNED_URL_INVALID');}if(url.protocol!=='https:'||url.username||url.password||!/(^|\.)s3([.-][a-z0-9-]+)?\.amazonaws\.com$/.test(url.hostname))throw Error('SANDBOX_VALIDATOR_REPORT_SIGNED_URL_INVALID');return url.href;};
export async function downloadValidatorReopenReportFromReceipt({receipt,artifactEvidence,currentVersionId,env=process.env,fetcher=fetch}={}){
 if(!receipt||!artifactEvidence||!env.APS_CLIENT_ID?.trim()||!env.APS_CLIENT_SECRET?.trim()||receipt.runId!==artifactEvidence.runId||receipt.manifestSha256!==artifactEvidence.manifestSha256||receipt.artifactEvidenceSha256!==artifactEvidence.evidenceSha256||!hex(artifactEvidence.evidenceSha256)||receipt.reportKey!==receipt.runId+'/archon-reopen-report.json')throw Error('SANDBOX_VALIDATOR_REPORT_CONFIGURATION_INVALID');
 const expectedBucket='archon_sandbox_'+hash(Buffer.from(env.APS_CLIENT_ID)).slice(0,24);if(receipt.bucketKey!==expectedBucket)throw Error('SANDBOX_VALIDATOR_REPORT_BUCKET_MISMATCH');
 const request=async(url,options={})=>{try{return await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(30000)});}catch{throw Error('SANDBOX_VALIDATOR_REPORT_REQUEST_FAILED');}},json=async response=>{try{return await response.json();}catch{throw Error('SANDBOX_VALIDATOR_REPORT_RESPONSE_INVALID');}};
 const auth=await request(host+'/authentication/v2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:'Basic '+Buffer.from(env.APS_CLIENT_ID+':'+env.APS_CLIENT_SECRET).toString('base64')},body:new URLSearchParams({grant_type:'client_credentials',scope:'bucket:read data:read data:write'}).toString()});
 if(!auth.ok)throw Error('SANDBOX_VALIDATOR_REPORT_AUTH_HTTP_'+auth.status);const token=(await json(auth))?.access_token;if(typeof token!=='string'||!token)throw Error('SANDBOX_VALIDATOR_REPORT_TOKEN_INVALID');
 const base=host+'/oss/v2/buckets/'+receipt.bucketKey,api=async(suffix,method='GET',body)=>{const response=await request(base+suffix,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});if(!response.ok)throw Error('SANDBOX_VALIDATOR_REPORT_API_HTTP_'+response.status);return json(response);};
 const owned=await api('/details');if(owned.bucketKey!==expectedBucket||owned.bucketOwner!==env.APS_CLIENT_ID||owned.policyKey!=='transient')throw Error('SANDBOX_VALIDATOR_REPORT_BUCKET_MISMATCH');
 const object='/objects/'+encodeURIComponent(receipt.reportKey);
 await api(object+'/signeds3upload','POST',{uploadKey:receipt.uploadKey});
 const details=await api(object+'/details');if(!Number.isInteger(details.size)||details.size<2||details.size>1024*1024)throw Error('SANDBOX_VALIDATOR_REPORT_SIZE_INVALID');
 const signed=await api(object+'/signeds3download?minutesExpiration=10');if(signed.status!=='complete')throw Error('SANDBOX_VALIDATOR_REPORT_DOWNLOAD_NOT_COMPLETE');
 const response=await request(safe(signed.url));if(!response.ok||!response.body)throw Error('SANDBOX_VALIDATOR_REPORT_DOWNLOAD_FAILED');
 let size=0;const chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>1024*1024)throw Error('SANDBOX_VALIDATOR_REPORT_SIZE_INVALID');chunks.push(chunk);}
 if(size!==details.size)throw Error('SANDBOX_VALIDATOR_REPORT_SIZE_MISMATCH');const reportBytes=Buffer.concat(chunks),review=validateNativeReopenReport({bytes:reportBytes,artifactEvidence,currentVersionId});
 const result={state:'SANDBOX_VALIDATOR_REOPEN_REPORT_REVIEW_READY',reportSha256:review.reportSha256,entityCount:review.entityCount,nativeDwgReopenVerified:true,reconciliation:'PROPOSE_CHANGESET_ONLY',approvalGranted:false,executionEnabled:false,checklist:review.checklist};
 Object.defineProperty(result,'reportBytes',{value:reportBytes,enumerable:false});return Object.freeze(result);
}
