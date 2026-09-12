import {createHash} from 'node:crypto';
export async function probeSandboxResources({env=process.env,fetcher=fetch,verifyBundle=false}={}) {
 if(!env.APS_CLIENT_ID?.trim()||!env.APS_CLIENT_SECRET?.trim())throw Error('SANDBOX_APS_CREDENTIALS_REQUIRED');
 const host='https://developer.api.autodesk.com',base=host+'/da/us-east/v3';
 const request=async(url,options={})=>{try{return await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(30000)});}catch{throw Error('SANDBOX_APS_REQUEST_FAILED');}};
 const parse=async(r)=>{if(!r.ok)throw Error('SANDBOX_APS_HTTP_'+r.status);try{return await r.json();}catch{throw Error('SANDBOX_APS_RESPONSE_INVALID');}};
 const auth=await parse(await request(host+'/authentication/v2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:'Basic '+Buffer.from(env.APS_CLIENT_ID+':'+env.APS_CLIENT_SECRET).toString('base64')},body:new URLSearchParams({grant_type:'client_credentials',scope:'code:all'}).toString()}));
 if(typeof auth.access_token!=='string'||!auth.access_token.trim())throw Error('SANDBOX_APS_TOKEN_INVALID');
 const api=async(path)=>parse(await request(base+path,{headers:{Authorization:'Bearer '+auth.access_token}}));
 const own=await api('/forgeapps/me'),namespace=typeof own==='string'?own:own?.nickname;
 if(typeof namespace!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(namespace))throw Error('SANDBOX_APS_NAMESPACE_INVALID');
 const activityId=namespace+'.ArchonGenerateLayout+v0_1',appBundleId=namespace+'.ArchonLayoutBundle+v0_1',engine='Autodesk.AutoCAD+25_1';
 if(env.APS_ACTIVITY_ID!==activityId||env.APS_APPBUNDLE_ID!==appBundleId||env.APS_AUTOCAD_ENGINE!==engine)throw Error('SANDBOX_APS_CONFIG_MISMATCH');
 const bundleAlias=await api('/appbundles/ArchonLayoutBundle/aliases/v0_1'),activityAlias=await api('/activities/ArchonGenerateLayout/aliases/v0_1');
 if(bundleAlias.version!==1||activityAlias.version!==1)throw Error('SANDBOX_APS_VERSION_MISMATCH');
 const bundle=await api('/appbundles/'+encodeURIComponent(appBundleId)),activity=await api('/activities/'+encodeURIComponent(activityId));
 const command='"$(engine.path)\\accoreconsole.exe" /i "$(args[seedDwg].path)" /al "$(appbundles[ArchonLayoutBundle].path)" /s "$(settings[script].path)"';
 if(bundle.engine!==engine||activity.engine!==engine||JSON.stringify(activity.appbundles)!==JSON.stringify([appBundleId])||JSON.stringify(activity.commandLine)!==JSON.stringify([command])||activity.settings?.script?.value!=='ARCHONLAYOUT\n')throw Error('SANDBOX_APS_RESOURCE_MISMATCH');
 const parameters={seedDwg:['get','seed.dwg'],inputJson:['get','archon-input.json'],outputDwg:['put','archon-output.dwg'],report:['put','archon-report.json']};
 // Autodesk Parameter.gen.cs specifies false defaults and EmitDefaultValue=false
 // for zip/ondemand. Only absence receives that default; null and other types fail.
 // https://github.com/Autodesk-Forge/forge-api-dotnet-design.automation/blob/main/src/Autodesk.Forge.DesignAutomation/Model/Parameter.gen.cs
 const defaultFalse=value=>value===undefined||value===false;
 if(Object.keys(activity.parameters??{}).length!==4||Object.entries(parameters).some(([key,[verb,localName]])=>activity.parameters[key]?.verb!==verb||activity.parameters[key]?.localName!==localName||activity.parameters[key]?.required!==true||!defaultFalse(activity.parameters[key]?.zip)||!defaultFalse(activity.parameters[key]?.ondemand)))throw Error('SANDBOX_APS_PARAMETER_MISMATCH');
 let bundleBytesReverified=false;
 if(verifyBundle){
  let url;try{url=new URL(bundle.package);}catch{throw Error('SANDBOX_BUNDLE_URL_INVALID');}
  if(url.protocol!=='https:'||url.username||url.password||!/(^|\.)s3([.-][a-z0-9-]+)?\.amazonaws\.com$/.test(url.hostname))throw Error('SANDBOX_BUNDLE_URL_INVALID');
  const response=await request(url.href); // Never forward OAuth headers to storage.
  if(!response.ok||!response.body)throw Error('SANDBOX_BUNDLE_DOWNLOAD_FAILED');
  const hash=createHash('sha256');let size=0;
  for await(const chunk of response.body){size+=chunk.length;if(size>20*1024*1024)throw Error('SANDBOX_BUNDLE_SIZE_LIMIT');hash.update(chunk);}
  if(!size||hash.digest('hex')!=='b6e8bf081b3267d87efc4c1dcee92e8aaacb3585d33a07365bc0a21487636bad')throw Error('SANDBOX_BUNDLE_DIGEST_MISMATCH');
  bundleBytesReverified=true;
 }
 return {state:'SANDBOX_APS_RESOURCE_SPEC_VERIFIED',namespace,engine,activityId,appBundleId,activityVersion:1,appBundleVersion:1,bundleBytesReverified,executionEnabled:false,pending:[...(bundleBytesReverified?[]:['BUNDLE_BYTE_DIGEST_RECHECK']),'SEED_AND_INPUT_READBACK','OUTPUT_ABSENCE_AND_FRESH_CAPABILITIES','EXPLICIT_SANDBOX_JOB_APPROVAL']};
}
