import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {ApsAuthService,getApsConfig} from '../engine-adapters/src/aps.ts';
import {prepareSandboxStorage} from './sandbox-storage.mjs';
import {provision} from './provision-resources.mjs';

let status={state:'STARTING',executionEnabled:false};
const mode=process.env.ARCHON_APS_WORKER_MODE??'DISCOVER';
const server=process.env.ARCHON_APS_WORKER_EXIT==='1'?undefined:createServer((req,res)=>{
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'||!['/health','/status'].includes(req.url)) {res.writeHead(404);res.end('{}');return;}
  res.writeHead(req.url==='/health'&&['STARTING','FAILED'].includes(status.state)?503:200);
  res.end(JSON.stringify(status));
}).listen(Number(process.env.PORT??8080),'0.0.0.0');
try {
  if(!['OFFLINE','DISCOVER','APPLY','STORAGE_PREPARE'].includes(mode)) throw Error('WORKER_MODE_INVALID');
  const zip=readFileSync(new URL('./artifacts/ArchonLayoutBundle.zip',import.meta.url));
  const expected=readFileSync(new URL('./artifacts/ArchonLayoutBundle.zip.sha256',import.meta.url),'utf8').split(/\s+/)[0];
  if(createHash('sha256').update(zip).digest('hex')!==expected) throw Error('WORKER_BUNDLE_DIGEST_MISMATCH');
  if(mode==='OFFLINE') status={state:'OFFLINE_BUNDLE_VERIFIED',bundleSha256:expected,executionEnabled:false};
  else {
    const token=await new ApsAuthService(getApsConfig()).getToken();
    const response=await fetch('https://developer.api.autodesk.com/da/us-east/v3/forgeapps/me',{headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(10000)});
    if(!response.ok) throw Error('WORKER_NAMESPACE_HTTP_'+response.status);
    let body;try {body=await response.json();} catch {throw Error('WORKER_NAMESPACE_INVALID');}
    const namespace=typeof body==='string'?body:body?.nickname;
    if(typeof namespace!=='string'||!/^[A-Za-z0-9_-]+$/.test(namespace)) throw Error('WORKER_NAMESPACE_INVALID');
    if(mode==='APPLY'&&namespace!==process.env.ARCHON_APS_EXPECTED_NAMESPACE) throw Error('WORKER_EXPECTED_NAMESPACE_MISMATCH');
    const result=mode==='STORAGE_PREPARE'
      ? await prepareSandboxStorage({input:readFileSync(new URL('../../archon-contract-fixture.json',import.meta.url))})
      : await provision({namespace,zip,sha256:expected,apply:mode==='APPLY'});
    status={...result,state:mode==='DISCOVER'?'NAMESPACE_AND_BUNDLE_VERIFIED':result.state};
  }
} catch(error) {
  // Only known worker/APS diagnostic codes escape; never log provider bodies or fetch exceptions.
  const diagnostic=/^(WORKER_|APS_|OSS_)[A-Z0-9_]+$/.test(error.message)?error.message:'WORKER_PROVISIONING_FAILED';
  status={state:'FAILED',diagnostic,executionEnabled:false};
  process.exitCode=1;
}
console.log('ARCHON_APS_WORKER_RESULT '+JSON.stringify(status));
if(!server) process.exit(status.state==='FAILED'?1:0);
for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>server?.close(()=>process.exit(0)));
