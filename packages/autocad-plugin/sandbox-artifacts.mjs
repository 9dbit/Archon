import {createHash} from 'node:crypto';
import {probeSandboxResources} from './sandbox-resources.mjs';
import {prepareSandboxStorage} from './sandbox-storage.mjs';
import {sandboxInput} from './sandbox-fixture.mjs';
const host='https://developer.api.autodesk.com';
const runId='archon-layout-smoke-20260912-v1';
const artifacts=[
 {name:'seed',key:'archon-seed-c935e19c89274600/seed.dwg',size:37894226,sha256:'17fbfaa1f29dce4444844cfbc7eb553077bef957ee3d605f4a56538597c4da80',header:'AC1024'},
 {name:'input',key:runId+'/archon-input.json',size:2108,sha256:'70f9fab1673d29d82c71ceb75e56d5b13865900b772ffccc6dd1153baa18b3ff'}
];
let inputPreparationAttempted=false;
export async function prepareReviewedSandboxInput({env=process.env,fetcher=fetch}={}){
 const preflight=await probeSandboxArtifacts({env,fetcher});
 if(!preflight.checks.find(c=>c.artifact==='seed')?.bytesVerified)throw Error('SANDBOX_INPUT_SEED_REQUIRED');
 if(preflight.checks.find(c=>c.artifact==='input')?.bytesVerified)return {...preflight,inputPreparation:'ALREADY_VERIFIED_NO_WRITE'};
 if(inputPreparationAttempted)throw Error('SANDBOX_INPUT_ALREADY_ATTEMPTED');
 const expected=artifacts[1];
 if(sandboxInput.length!==expected.size||createHash('sha256').update(sandboxInput).digest('hex')!==expected.sha256)throw Error('SANDBOX_INPUT_FIXTURE_MISMATCH');
 inputPreparationAttempted=true; // Ambiguous preparation is read back before any manual retry.
 try{
  await prepareSandboxStorage({input:Buffer.from(sandboxInput),env,fetcher,runId});
 }catch{throw Error('SANDBOX_INPUT_PREPARATION_FAILED_VERIFY_STORAGE');}
 return {...await probeSandboxArtifacts({env,fetcher}),inputPreparation:'FIXED_SYNTHETIC_INPUT_UPLOADED_AND_READ_BACK'};
}
export async function verifyArtifactResponse(response,{size,sha256,header}){
 if(!response.ok||!response.body)throw Error('SANDBOX_ARTIFACT_DOWNLOAD_FAILED');
 const length=response.headers.get('content-length');
 if(length!==null&&Number(length)!==size)throw Error('SANDBOX_ARTIFACT_SIZE_MISMATCH');
 const hash=createHash('sha256');let received=0,prefix=Buffer.alloc(0);
 for await(const chunk of response.body){
  received+=chunk.length;if(received>size)throw Error('SANDBOX_ARTIFACT_SIZE_MISMATCH');
  if(prefix.length<6)prefix=Buffer.concat([prefix,Buffer.from(chunk)]).subarray(0,6);
  hash.update(chunk);
 }
 if(received!==size||hash.digest('hex')!==sha256)throw Error('SANDBOX_ARTIFACT_DIGEST_MISMATCH');
 if(header&&prefix.toString('ascii')!==header)throw Error('SANDBOX_ARTIFACT_HEADER_MISMATCH');
 return true;
}
export async function probeSandboxArtifacts({env=process.env,fetcher=fetch}={}){
 const resources=await probeSandboxResources({env,fetcher,verifyBundle:true});
 const request=async(url,options={})=>{try{return await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(120000)});}catch{throw Error('SANDBOX_ARTIFACT_REQUEST_FAILED');}};
 const parse=async(r)=>{if(!r.ok)throw Error('SANDBOX_ARTIFACT_HTTP_'+r.status);try{return await r.json();}catch{throw Error('SANDBOX_ARTIFACT_RESPONSE_INVALID');}};
 const auth=await parse(await request(host+'/authentication/v2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:'Basic '+Buffer.from(env.APS_CLIENT_ID+':'+env.APS_CLIENT_SECRET).toString('base64')},body:new URLSearchParams({grant_type:'client_credentials',scope:'bucket:read data:read'}).toString()}));
 if(typeof auth.access_token!=='string'||!auth.access_token.trim())throw Error('SANDBOX_ARTIFACT_TOKEN_INVALID');
 const bucket='archon_sandbox_'+createHash('sha256').update(env.APS_CLIENT_ID).digest('hex').slice(0,24),base=host+'/oss/v2/buckets/'+bucket;
 const get=suffix=>request(base+suffix,{headers:{Authorization:'Bearer '+auth.access_token}});
 const owner=await parse(await get('/details'));
 if(owner.bucketKey!==bucket||owner.bucketOwner!==env.APS_CLIENT_ID||owner.policyKey!=='transient')throw Error('SANDBOX_ARTIFACT_BUCKET_MISMATCH');
 const checks=[];
 for(const artifact of artifacts){
  const object='/objects/'+encodeURIComponent(artifact.key),response=await get(object+'/details');
  if(response.status===404){checks.push({artifact:artifact.name,status:'MISSING',bytesVerified:false});continue;}
  const details=await parse(response);
  if(details.size!==artifact.size)throw Error('SANDBOX_ARTIFACT_SIZE_MISMATCH');
  const signed=await parse(await get(object+'/signeds3download?minutesExpiration=10'));
  if(signed.status!=='complete')throw Error('SANDBOX_ARTIFACT_DOWNLOAD_NOT_COMPLETE');
  let url;try{url=new URL(signed.url);}catch{throw Error('SANDBOX_ARTIFACT_URL_INVALID');}
  if(url.protocol!=='https:'||url.username||url.password||!/(^|\.)s3([.-][a-z0-9-]+)?\.amazonaws\.com$/.test(url.hostname))throw Error('SANDBOX_ARTIFACT_URL_INVALID');
  await verifyArtifactResponse(await request(url.href),artifact);
  checks.push({artifact:artifact.name,status:'VERIFIED',bytesVerified:true});
 }
 for(const file of ['archon-output.dwg','archon-report.json']){
  const response=await get('/objects/'+encodeURIComponent(runId+'/'+file)+'/details');
  if(response.status!==404)throw Error('SANDBOX_OUTPUT_ALREADY_EXISTS_OR_UNAVAILABLE');
 }
 return {state:'SANDBOX_ARTIFACT_PREFLIGHT_CHECKED',runId,bundleBytesReverified:resources.bundleBytesReverified,checks,outputsAbsent:true,capabilitiesReserved:false,nativeDwgOpenVerified:false,executionEnabled:false,approvalGranted:false,pending:[...checks.filter(c=>!c.bytesVerified).map(c=>c.artifact.toUpperCase()+'_PREPARATION_REQUIRED'),'FRESH_CAPABILITIES_AT_SUBMISSION','EXPLICIT_SANDBOX_JOB_APPROVAL']};
}
