import {createHash,timingSafeEqual} from 'node:crypto';

const host='https://developer.api.autodesk.com';
const digest=(bytes,algorithm='sha256')=>createHash(algorithm).update(bytes).digest('hex');
const limit=64*1024*1024,partSize=5*1024*1024;
const leases=new Set();
export async function handleSeedUpload(request,env=process.env,fetcher=fetch) {
  const fail=(code,status=400)=>Response.json({error:code,executionEnabled:false},{status});
  const expected=env.ARCHON_SEED_SHA256,size=Number(env.ARCHON_SEED_BYTES),runId=env.ARCHON_SEED_RUN_ID;
  const expires=Number(env.ARCHON_SEED_UPLOAD_EXPIRES_AT);
  if(env.ARCHON_SEED_UPLOAD_ENABLED!=='true'||!Number.isFinite(expires)||expires<=Date.now()||expires>Date.now()+31*60000) return fail('SEED_UPLOAD_DISABLED',403);
  const token=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  const tokenHash=env.ARCHON_SEED_UPLOAD_TOKEN_SHA256;
  if(!token||!/^[a-f0-9]{64}$/.test(tokenHash??'')||!timingSafeEqual(Buffer.from(digest(token),'hex'),Buffer.from(tokenHash,'hex'))) return fail('SEED_UPLOAD_UNAUTHORIZED',403);
  if(!/^[a-f0-9]{64}$/.test(expected??'')||!Number.isInteger(size)||size<100||size>limit||!/^[A-Za-z0-9_-]{1,80}$/.test(runId??'')) return fail('SEED_CONFIGURATION_INVALID',503);
  if(request.method!=='POST'||request.headers.get('content-type')!=='application/octet-stream'||request.headers.get('content-length')!==String(size)) return fail('SEED_REQUEST_INVALID');
  const lease=runId+':'+expected;
  if(leases.has(lease)) return fail('SEED_UPLOAD_ALREADY_ATTEMPTED',409);
  // A failed or concurrent attempt is never retried automatically in this process.
  leases.add(lease);
  try {
    if(!request.body) throw Error('SEED_BODY_MISSING');
    const reader=request.body.getReader(),chunks=[];let received=0;
    while(true) {const part=await reader.read();if(part.done) break;received+=part.value.length;if(received>size||received>limit) {await reader.cancel();throw Error('SEED_SIZE_LIMIT');}chunks.push(part.value);}
    const bytes=Buffer.concat(chunks);
    if(received!==size||digest(bytes)!==expected) throw Error('SEED_BYTES_MISMATCH');
    if(!/^AC10(?:15|18|21|24|27|32)$/.test(bytes.subarray(0,6).toString('ascii'))) throw Error('SEED_DWG_HEADER_INVALID');
    const result=await uploadSeed({bytes,runId,env,fetcher});
    return Response.json(result,{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    const code=/^SEED_[A-Z0-9_]+$/.test(error.message)?error.message:'SEED_UPLOAD_FAILED';
    return fail(code,code==='SEED_BYTES_MISMATCH'||code==='SEED_SIZE_LIMIT'||code==='SEED_DWG_HEADER_INVALID'?400:502);
  }
}

export async function uploadSeed({bytes,runId,env=process.env,fetcher=fetch}) {
  if(!Buffer.isBuffer(bytes)||bytes.length<100||bytes.length>limit||!/^[A-Za-z0-9_-]{1,80}$/.test(runId??'')) throw Error('SEED_INPUT_INVALID');
  if(!env.APS_CLIENT_ID?.trim()||!env.APS_CLIENT_SECRET?.trim()) throw Error('SEED_CREDENTIALS_MISSING');
  const request=async(url,options={})=>{try {return await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(120000)});} catch {throw Error('SEED_REQUEST_FAILED');}};
  const json=async(response)=>{try {return await response.json();} catch {throw Error('SEED_RESPONSE_INVALID');}};
  const auth=await request(host+'/authentication/v2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:'Basic '+Buffer.from(env.APS_CLIENT_ID+':'+env.APS_CLIENT_SECRET).toString('base64')},body:new URLSearchParams({grant_type:'client_credentials',scope:'bucket:read data:read data:write'}).toString()});
  if(!auth.ok) throw Error('SEED_AUTH_HTTP_'+auth.status);
  const token=(await json(auth))?.access_token;if(typeof token!=='string'||!token.trim()) throw Error('SEED_TOKEN_INVALID');
  const bucket='archon_sandbox_'+digest(env.APS_CLIENT_ID).slice(0,24),path='/buckets/'+bucket;
  const api=async(suffix,method='GET',body)=>{
    const response=await request(host+'/oss/v2'+path+suffix,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    if(!response.ok) throw Error('SEED_API_HTTP_'+response.status);return json(response);
  };
  const owned=await api('/details');if(owned.bucketKey!==bucket||owned.bucketOwner!==env.APS_CLIENT_ID||owned.policyKey!=='transient') throw Error('SEED_BUCKET_OWNERSHIP_MISMATCH');
  const key=runId+'/seed.dwg',object='/objects/'+encodeURIComponent(key);
  const existing=await request(host+'/oss/v2'+path+object+'/details',{headers:{Authorization:'Bearer '+token}});
  if(existing.status!==404) throw Error('SEED_OBJECT_ALREADY_EXISTS_OR_UNAVAILABLE');
  const parts=Math.ceil(bytes.length/partSize);
  const signed=await api(object+'/signeds3upload?parts='+parts+'&firstPart=1&minutesExpiration=30');
  if(!Array.isArray(signed.urls)||signed.urls.length!==parts||typeof signed.uploadKey!=='string'||!signed.uploadKey) throw Error('SEED_SIGNING_INVALID');
  const urls=signed.urls.map(value=>{let url;try {url=new URL(value);} catch {throw Error('SEED_SIGNED_URL_INVALID');}
    if(url.protocol!=='https:'||url.username||url.password||!/(^|\.)s3([.-][a-z0-9-]+)?\.amazonaws\.com$/.test(url.hostname)) throw Error('SEED_SIGNED_URL_INVALID');return url.href;});
  for(let index=0;index<parts;index++) {const response=await request(urls[index],{method:'PUT',body:bytes.subarray(index*partSize,Math.min((index+1)*partSize,bytes.length))});if(!response.ok) throw Error('SEED_PART_UPLOAD_HTTP_'+response.status);}
  await api(object+'/signeds3upload','POST',{uploadKey:signed.uploadKey});
  const details=await api(object+'/details');
  if(details.size!==bytes.length||details.sha1?.toLowerCase()!==digest(bytes,'sha1')) throw Error('SEED_OSS_INTEGRITY_MISMATCH');
  return {state:'SEED_STORED_IN_SANDBOX',bucketKey:bucket,objectKey:key,bytes:bytes.length,sha256:digest(bytes),sha1:digest(bytes,'sha1'),dwgHeader:bytes.subarray(0,6).toString('ascii'),nativeOpenVerified:false,executionEnabled:false};
}
