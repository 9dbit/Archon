import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const base='https://developer.api.autodesk.com/da/us-east/v3';
const namespacePattern=/^[A-Za-z0-9_-]+$/;
export async function provision({namespace,zip,sha256,apply=false,env=process.env,fetcher=fetch}) {
  if(!namespacePattern.test(namespace??'')) throw Error('A real APS namespace is required.');
  if(!Buffer.isBuffer(zip)||zip.length<4||zip.length>20*1024*1024||zip.readUInt32LE(0)!==0x04034b50) throw Error('A bundle ZIP up to 20 MB is required.');
  if(!/^[a-f0-9]{64}$/.test(sha256??'')||createHash('sha256').update(zip).digest('hex')!==sha256) throw Error('Bundle SHA256 mismatch.');
  const bundle='ArchonLayoutBundle', activity='ArchonGenerateLayout', alias='v0_1', engine='Autodesk.AutoCAD+25_1';
  const plan={namespace,engine,bundle,activity,alias,bundleSha256:sha256,executionEnabled:false};
  if(!apply) return {state:'DRY_RUN',...plan};
  if(!env.APS_CLIENT_ID||!env.APS_CLIENT_SECRET) throw Error('APS client credentials are required for resource provisioning.');
  const request=async(url,options={})=>{
    let response;
    try {response=await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(120000)});} catch {throw Error('APS request failed; inspect remote resource state before retrying.');}
    return response;
  };
  const auth=await request('https://developer.api.autodesk.com/authentication/v2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.APS_CLIENT_ID,client_secret:env.APS_CLIENT_SECRET,grant_type:'client_credentials',scope:'code:all'})});
  if(!auth.ok) throw Error('APS OAuth failed (HTTP '+auth.status+').');
  let authBody;
  try {authBody=await auth.json();} catch {throw Error('Invalid APS OAuth response.');}
  const token=authBody?.access_token;
  if(typeof token!=='string'||!token) throw Error('APS OAuth returned no token.');
  const api=async(path,method='GET',body)=>{
    const r=await request(base+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    if(!r.ok) throw Error('APS '+method+' '+path+' failed (HTTP '+r.status+'); no automatic retry or rollback.');
    try {return r.status===204?null:await r.json();} catch {throw Error('Invalid APS API response for '+path+'.');}
  };
  const own=await api('/forgeapps/me');
  const actual=typeof own==='string'?own:own?.nickname;
  if(actual!==namespace) throw Error('Namespace does not match authenticated APS application.');
  await api('/engines/'+encodeURIComponent(engine));
  // Both resources must be absent before any write. Never update shared/existing aliases.
  for(const path of ['/appbundles/'+bundle+'/aliases','/activities/'+activity+'/aliases']) {
    const r=await request(base+path,{headers:{Authorization:'Bearer '+token}});
    if(r.status!==404) throw Error('Resource preflight requires HTTP 404 for '+path+'; existing resources are never overwritten.');
  }
  const created=await api('/appbundles','POST',{id:bundle,engine,description:'ARCHON sandbox drawing generator'});
  if(!Number.isInteger(created.version)||created.version<1) throw Error('AppBundle returned invalid version.');
  const upload=created.uploadParameters;
  let endpoint;
  try {endpoint=new URL(upload?.endpointURL);} catch {throw Error('Invalid bundle upload endpoint.');}
  if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||!/(^|\.)s3([.-][a-z0-9-]+)?\.amazonaws\.com$/.test(endpoint.hostname)) throw Error('Bundle upload must target Autodesk-issued Amazon S3 HTTPS endpoint.');
  if(!upload.formData||typeof upload.formData!=='object'||Array.isArray(upload.formData)) throw Error('Invalid bundle upload fields.');
  const form=new FormData();
  for(const [key,value] of Object.entries(upload.formData)) {if(typeof value!=='string') throw Error('Invalid upload form field.');form.append(key,value);}
  form.append('file',new Blob([zip],{type:'application/zip'}),'ArchonLayoutBundle.zip');
  const uploaded=await request(endpoint.href,{method:'POST',body:form});
  if(!uploaded.ok) throw Error('Bundle upload failed (HTTP '+uploaded.status+'); resource remains unaliased.');
  await api('/appbundles/'+bundle+'/aliases','POST',{id:alias,version:created.version});
  const bundled=await api('/appbundles/'+bundle+'/aliases/'+alias);
  if(bundled.version!==created.version) throw Error('AppBundle alias verification failed.');
  const parameter=(verb,localName)=>({verb,localName,required:true,zip:false,ondemand:false});
  const spec={id:activity,engine,appbundles:[namespace+'.'+bundle+'+'+alias],commandLine:['"$(engine.path)\\accoreconsole.exe" /i "$(args[seedDwg].path)" /al "$(appbundles['+bundle+'].path)" /s "$(settings[script].path)"'],parameters:{seedDwg:parameter('get','seed.dwg'),inputJson:parameter('get','archon-input.json'),outputDwg:parameter('put','archon-output.dwg'),report:parameter('put','archon-report.json')},settings:{script:{value:'ARCHONLAYOUT\n'}}};
  const made=await api('/activities','POST',spec);
  if(!Number.isInteger(made.version)||made.version<1) throw Error('Activity returned invalid version.');
  await api('/activities/'+activity+'/aliases','POST',{id:alias,version:made.version});
  const verified=await api('/activities/'+activity+'/aliases/'+alias);
  if(verified.version!==made.version) throw Error('Activity alias verification failed.');
  const readback=await api('/activities/'+encodeURIComponent(namespace+'.'+activity+'+'+alias));
  if(readback.engine!==engine||JSON.stringify(readback.appbundles)!==JSON.stringify(spec.appbundles)||JSON.stringify(readback.commandLine)!==JSON.stringify(spec.commandLine)) throw Error('Activity readback mismatch.');
  for(const [key,value] of Object.entries(spec.parameters)) {
    if(readback.parameters?.[key]?.verb!==value.verb||readback.parameters?.[key]?.localName!==value.localName||readback.parameters?.[key]?.required!==true) throw Error('Activity parameter readback mismatch.');
  }
  if(readback.settings?.script?.value!==spec.settings.script.value) throw Error('Activity script readback mismatch.');
  return {state:'RESOURCES_VERIFIED',...plan,appBundleVersion:created.version,activityVersion:made.version,railway:{APS_AUTOCAD_ENGINE:engine,APS_APPBUNDLE_ID:namespace+'.'+bundle+'+'+alias,APS_ACTIVITY_ID:namespace+'.'+activity+'+'+alias}};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const [namespace,path,digest,flag]=process.argv.slice(2);
    if(existsSync('archon-aps-provisioning-result.json')) throw Error('Archive the previous provisioning result before starting.');
    if(flag&&flag!=='--apply') throw Error('Only --apply is supported; default is offline dry-run.');
    const result=await provision({namespace,zip:readFileSync(path),sha256:digest,apply:flag==='--apply'});
    writeFileSync('archon-aps-provisioning-result.json',JSON.stringify(result,null,2),{flag:'wx'});
    console.log(result.state+'; execution disabled.');
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
