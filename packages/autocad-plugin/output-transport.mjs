import {createHash,randomUUID} from 'node:crypto';

const host='https://developer.api.autodesk.com';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function validateOutputReport({inputBytes,reportBytes,currentVersionId}) {
  if(!Buffer.isBuffer(inputBytes)||!Buffer.isBuffer(reportBytes)||inputBytes.length>16*1024*1024||reportBytes.length>16*1024*1024) throw Error('OUTPUT_BYTES_INVALID');
  let input,report;
  try {input=JSON.parse(inputBytes);report=JSON.parse(reportBytes);} catch {throw Error('OUTPUT_JSON_INVALID');}
  if(input?.schemaVersion!==1||input.units!=='mm'||!Array.isArray(input.entities)||!input.entities.length||input.entities.length>10000) throw Error('OUTPUT_INPUT_INVALID');
  if(currentVersionId!==input.source?.versionId) throw Error('OUTPUT_STALE_SOURCE');
  if(report?.schemaVersion!==1||report.units!=='mm'||report.coordinateMapping!=='ARCHON_XZ_TO_CAD_XY'||report.inputSha256!==hash(inputBytes)||report.outputFile!=='archon-output.dwg'||report.reconciliation!=='PROPOSE_CHANGESET_ONLY'||report.governanceAuthority!=='NONE') throw Error('OUTPUT_REPORT_CONTRACT_MISMATCH');
  for(const key of ['projectId','versionId','mode','level','changeSetId']) if(report.source?.[key]!==input.source?.[key]) throw Error('OUTPUT_SOURCE_MISMATCH');
  if(!Array.isArray(report.entities)||report.entities.length!==input.entities.length) throw Error('OUTPUT_ENTITY_COUNT_MISMATCH');
  const indices=new Set(),handles=new Set();
  const point=(actual,expected)=>Array.isArray(actual)&&actual.length===2&&actual.every((value,index)=>typeof value==='number'&&Number.isFinite(value)&&Math.abs(value-expected[index])<=1e-6);
  for(const entity of report.entities) {
    const index=entity?.inputIndex;
    if(!Number.isInteger(index)||index<0||index>=input.entities.length||indices.has(index)) throw Error('OUTPUT_ENTITY_INDEX_INVALID');
    indices.add(index);const expected=input.entities[index];
    if(entity.sourceId!==expected.sourceId||entity.revision!==expected.revision||entity.kind!==expected.kind||entity.layer!==expected.layer) throw Error('OUTPUT_ENTITY_IDENTITY_MISMATCH');
    if(typeof entity.handle!=='string'||!/^[0-9A-F]+$/i.test(entity.handle)||entity.handle==='0'||handles.has(entity.handle.toUpperCase())) throw Error('OUTPUT_HANDLE_INVALID');
    handles.add(entity.handle.toUpperCase());const geometry=entity.geometry;
    let match=false;
    if(expected.kind==='POLYLINE') match=geometry?.closed===true&&Array.isArray(geometry.pointsMm)&&geometry.pointsMm.length===expected.pointsMm.length&&geometry.pointsMm.every((p,i)=>point(p,expected.pointsMm[i]));
    else if(expected.kind==='TEXT') match=geometry?.text===expected.text&&point(geometry.positionMm,expected.positionMm);
    else if(expected.kind==='DIMENSION') match=point(geometry?.startMm,expected.startMm)&&point(geometry?.endMm,expected.endMm)&&typeof geometry?.measuredMm==='number'&&Number.isFinite(geometry.measuredMm)&&Math.abs(geometry.measuredMm-expected.measuredMm)<=1e-6;
    if(!match) throw Error('OUTPUT_GEOMETRY_MISMATCH');
  }
  return {state:'REPORT_MATCHES_PREPARED_INPUT',entityCount:indices.size,inputSha256:hash(inputBytes),reportSha256:hash(reportBytes),approvalGranted:false,reconciliation:'PROPOSE_CHANGESET_ONLY',checklist:[{category:'identity/geometry/dimensions',status:'PASS'},{category:'saved-DWG reopen/materials/design/rules',status:'PENDING'},{category:'ARCHON review/approval',status:'PENDING'}]};
}

// Private in-memory capability session. JSON serialization exposes only a redacted summary.
export async function reserveSandboxOutputs({env=process.env,fetcher=fetch,runId=randomUUID(),now=Date.now}) {
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(runId)) throw Error('OUTPUT_RUN_ID_INVALID');
  if(!env.APS_CLIENT_ID?.trim()||!env.APS_CLIENT_SECRET?.trim()) throw Error('OUTPUT_CREDENTIALS_MISSING');
  const request=async(url,options={})=>{try {return await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(30000)});} catch {throw Error('OUTPUT_REQUEST_FAILED');}};
  const json=async(response)=>{try {return await response.json();} catch {throw Error('OUTPUT_RESPONSE_INVALID');}};
  const auth=await request(host+'/authentication/v2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:'Basic '+Buffer.from(env.APS_CLIENT_ID+':'+env.APS_CLIENT_SECRET).toString('base64')},body:new URLSearchParams({grant_type:'client_credentials',scope:'bucket:read data:read data:write'}).toString()});
  if(!auth.ok) throw Error('OUTPUT_AUTH_HTTP_'+auth.status);
  const token=(await json(auth))?.access_token;if(typeof token!=='string'||!token.trim()) throw Error('OUTPUT_TOKEN_INVALID');
  const bucket='archon_sandbox_'+hash(Buffer.from(env.APS_CLIENT_ID)).slice(0,24);
  const path='/buckets/'+bucket;
  const api=async(suffix,method='GET',body)=>{
    const response=await request(host+'/oss/v2'+path+suffix,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    if(!response.ok) throw Error('OUTPUT_API_HTTP_'+response.status);return json(response);
  };
  const owned=await api('/details');
  if(owned.bucketKey!==bucket||owned.bucketOwner!==env.APS_CLIENT_ID||owned.policyKey!=='transient') throw Error('OUTPUT_BUCKET_OWNERSHIP_MISMATCH');
  const resources=[['outputDwg','archon-output.dwg'],['report','archon-report.json']].map(([argument,file])=>({argument,file,key:runId+'/'+file}));
  for(const resource of resources) {
    const response=await request(host+'/oss/v2'+path+'/objects/'+encodeURIComponent(resource.key)+'/details',{headers:{Authorization:'Bearer '+token}});
    if(response.status!==404) throw Error('OUTPUT_OBJECT_ALREADY_EXISTS_OR_UNAVAILABLE');
  }
  const safeUrl=value=>{let url;try {url=new URL(value);} catch {throw Error('OUTPUT_SIGNED_URL_INVALID');}
    if(url.protocol!=='https:'||url.username||url.password||!/(^|\.)s3([.-][a-z0-9-]+)?\.amazonaws\.com$/.test(url.hostname)) throw Error('OUTPUT_SIGNED_URL_INVALID');return url.href;};
  const started=now();
  for(const resource of resources) {
    const signed=await api('/objects/'+encodeURIComponent(resource.key)+'/signeds3upload?parts=1&firstPart=1&minutesExpiration=10');
    if(!Array.isArray(signed.urls)||signed.urls.length!==1||typeof signed.uploadKey!=='string'||!signed.uploadKey) throw Error('OUTPUT_UPLOAD_RESPONSE_INVALID');
    resource.url=safeUrl(signed.urls[0]);resource.uploadKey=signed.uploadKey;
  }
  let state='OUTPUT_UPLOAD_URLS_RESERVED',boundId,receiptExported=false;
  const summary=()=>({state,bucketKey:bucket,runId,outputObjectKeys:resources.map(r=>r.key),capabilityExpiresAt:new Date(started+10*60000).toISOString(),executionEnabled:false,approvalGranted:false});
  return Object.freeze({
    summary,toJSON:summary,
    exportFinalizationReceipt(manifestSha256) {
      if(receiptExported||state!=='OUTPUT_UPLOAD_URLS_RESERVED'||!/^[A-Za-z0-9_-]{1,80}$/.test(runId)||typeof manifestSha256!=='string'||!/^[a-f0-9]{64}$/.test(manifestSha256)||now()>=started+9*60000) throw Error('OUTPUT_RECEIPT_EXPORT_INVALID');
      receiptExported=true;
      const receipt={schemaVersion:1,runId,bucketKey:bucket,outputs:resources.map(({argument,key,uploadKey})=>({argument,key,uploadKey})),expiresAt:new Date(started+10*60000).toISOString()};
      Object.defineProperty(receipt,'toJSON',{value:()=>({schemaVersion:1,runId,bucketKey:bucket,outputKeys:resources.map(r=>r.key),expiresAt:receipt.expiresAt,secretsRedacted:true})});
      return Object.freeze(receipt);
    },
    // Future submission code must independently verify governance; this grants no execution authority.
    workitemArguments() {if(now()>=started+9*60000) throw Error('OUTPUT_CAPABILITIES_EXPIRED');if(state!=='OUTPUT_UPLOAD_URLS_RESERVED') throw Error('OUTPUT_SESSION_NOT_READY');return Object.fromEntries(resources.map(r=>[r.argument,{url:r.url,verb:'put'}]));},
    bindWorkitem(id) {if(boundId||state!=='OUTPUT_UPLOAD_URLS_RESERVED'||typeof id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw Error('OUTPUT_WORKITEM_BIND_INVALID');boundId=id;},
    async finalizeAfterSuccess({workitemId,status,inputBytes,currentVersionId}) {
      if(!boundId||workitemId!==boundId||status!=='success'||state!=='OUTPUT_UPLOAD_URLS_RESERVED') throw Error('OUTPUT_WORKITEM_SUCCESS_REQUIRED');
      // Caller must read success from APS. A supplied status is descriptive, never ARCHON approval.
      let prepared;try {prepared=JSON.parse(inputBytes);} catch {throw Error('OUTPUT_JSON_INVALID');}
      if(typeof currentVersionId!=='string'||!currentVersionId.trim()||currentVersionId!==prepared.source?.versionId) throw Error('OUTPUT_STALE_SOURCE');
      state='FINALIZING';
      try {
        const contents=[];
        for(const resource of resources) {
          const object='/objects/'+encodeURIComponent(resource.key);
          await api(object+'/signeds3upload','POST',{uploadKey:resource.uploadKey});
          const details=await api(object+'/details');
          if(!Number.isInteger(details.size)||details.size<=0||details.size>16*1024*1024) throw Error('OUTPUT_ARTIFACT_SIZE_INVALID');
          const signed=await api(object+'/signeds3download?minutesExpiration=10');if(signed.status!=='complete') throw Error('OUTPUT_DOWNLOAD_NOT_COMPLETE');
          const response=await request(safeUrl(signed.url));if(!response.ok||!response.body) throw Error('OUTPUT_DOWNLOAD_FAILED');
          let size=0;const chunks=[];
          for await(const chunk of response.body) {size+=chunk.length;if(size>16*1024*1024) throw Error('OUTPUT_DOWNLOAD_SIZE_LIMIT');chunks.push(chunk);}
          if(size!==details.size) throw Error('OUTPUT_DOWNLOAD_SIZE_MISMATCH');contents.push(Buffer.concat(chunks));
        }
        if(contents[0].length<100||contents[0].subarray(0,6).toString('ascii')!=='AC1032') throw Error('OUTPUT_DWG_HEADER_INVALID');
        const review=validateOutputReport({inputBytes,reportBytes:contents[1],currentVersionId});
        state='ARTIFACTS_REQUIRE_ARCHON_REVIEW';return {...summary(),workitemId,dwgSha256:hash(contents[0]),review,nativeDwgReopenVerified:false};
      } catch(error) {state='FAILED';throw error;}
    }
  });
}
