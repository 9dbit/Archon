import {createHash,randomUUID} from 'node:crypto';

const host='https://developer.api.autodesk.com';
export async function prepareSandboxStorage({input,env=process.env,fetcher=fetch,runId=randomUUID()}) {
  if(!Buffer.isBuffer(input)||!input.length||input.length>16*1024*1024) throw Error('OSS_INPUT_INVALID');
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(runId)) throw Error('OSS_RUN_ID_INVALID');
  if(!env.APS_CLIENT_ID?.trim()||!env.APS_CLIENT_SECRET?.trim()) throw Error('OSS_CREDENTIALS_MISSING');
  const request=async(url,options={})=>{
    try {return await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(30000)});} catch {throw Error('OSS_REQUEST_FAILED');}
  };
  const json=async(response)=>{try {return await response.json();} catch {throw Error('OSS_RESPONSE_INVALID');}};
  const auth=await request(host+'/authentication/v2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:'Basic '+Buffer.from(env.APS_CLIENT_ID+':'+env.APS_CLIENT_SECRET).toString('base64')},body:new URLSearchParams({grant_type:'client_credentials',scope:'bucket:create bucket:read data:read data:write'}).toString()});
  if(!auth.ok) throw Error('OSS_AUTH_HTTP_'+auth.status);
  const token=(await json(auth))?.access_token;
  if(typeof token!=='string'||!token.trim()) throw Error('OSS_TOKEN_INVALID');
  const api=async(path,method='GET',body)=>{
    const response=await request(host+'/oss/v2'+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    if(!response.ok) throw Error('OSS_API_HTTP_'+response.status);
    return json(response);
  };
  const bucket='archon_sandbox_'+createHash('sha256').update(env.APS_CLIENT_ID).digest('hex').slice(0,24);
  const path='/buckets/'+bucket;
  let details=await request(host+'/oss/v2'+path+'/details',{headers:{Authorization:'Bearer '+token}});
  if(details.status===404) await api('/buckets','POST',{bucketKey:bucket,policyKey:'transient'});
  else if(!details.ok) throw Error('OSS_BUCKET_HTTP_'+details.status);
  const owned=await api(path+'/details');
  if(owned.bucketKey!==bucket||owned.bucketOwner!==env.APS_CLIENT_ID||owned.policyKey!=='transient') throw Error('OSS_BUCKET_OWNERSHIP_MISMATCH');
  const key=runId+'/archon-input.json',object=path+'/objects/'+encodeURIComponent(key);
  const previous=await request(host+'/oss/v2'+object+'/details',{headers:{Authorization:'Bearer '+token}});
  if(previous.status!==404) throw Error('OSS_INPUT_ALREADY_EXISTS_OR_UNAVAILABLE');
  const signed=await api(object+'/signeds3upload?parts=1&firstPart=1&minutesExpiration=10');
  if(!Array.isArray(signed.urls)||signed.urls.length!==1||typeof signed.uploadKey!=='string'||!signed.uploadKey) throw Error('OSS_UPLOAD_RESPONSE_INVALID');
  const safeUrl=(value)=>{
    let url;try {url=new URL(value);} catch {throw Error('OSS_SIGNED_URL_INVALID');}
    if(url.protocol!=='https:'||url.username||url.password||!/(^|\.)s3([.-][a-z0-9-]+)?\.amazonaws\.com$/.test(url.hostname)) throw Error('OSS_SIGNED_URL_INVALID');
    return url.href;
  };
  // Signed requests never receive APS OAuth headers. No provider URLs enter logs/results.
  const uploaded=await request(safeUrl(signed.urls[0]),{method:'PUT',body:input});
  if(!uploaded.ok) throw Error('OSS_UPLOAD_HTTP_'+uploaded.status);
  await api(object+'/signeds3upload','POST',{uploadKey:signed.uploadKey});
  const finalized=await api(object+'/details');
  if(finalized.size!==input.length) throw Error('OSS_INPUT_SIZE_MISMATCH');
  const download=await api(object+'/signeds3download?minutesExpiration=10');
  if(download.status!=='complete') throw Error('OSS_DOWNLOAD_NOT_COMPLETE');
  const result=await request(safeUrl(download.url));
  if(!result.ok) throw Error('OSS_DOWNLOAD_HTTP_'+result.status);
  const length=Number(result.headers.get('content-length'));
  if(length>16*1024*1024) throw Error('OSS_DOWNLOAD_SIZE_LIMIT');
  if(!result.body) throw Error('OSS_DOWNLOAD_EMPTY');
  const chunks=[];let size=0;
  for await(const chunk of result.body) {size+=chunk.length;if(size>16*1024*1024) throw Error('OSS_DOWNLOAD_SIZE_LIMIT');chunks.push(chunk);}
  const digest=createHash('sha256').update(input).digest('hex');
  if(createHash('sha256').update(Buffer.concat(chunks)).digest('hex')!==digest) throw Error('OSS_DOWNLOAD_DIGEST_MISMATCH');
  return {state:'SANDBOX_STORAGE_VERIFIED',bucketKey:bucket,inputObjectKey:key,inputBytes:input.length,inputSha256:digest,retentionPolicy:'transient',seedDwgReady:false,outputTransport:'NOT_PREPARED',executionEnabled:false};
}
