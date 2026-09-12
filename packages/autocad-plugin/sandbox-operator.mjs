import {createHash,timingSafeEqual} from 'node:crypto';
export async function handleSandboxOperator(request,{env=process.env,activate,probe,artifacts,prepareInput,review,transport}={}) {
 const fail=(error,status=403)=>Response.json({error,executionEnabled:false},{status,headers:{'Cache-Control':'no-store'}});
 const expiry=Number(env.ARCHON_SANDBOX_SETUP_EXPIRES_AT);
 if(env.ARCHON_SANDBOX_SETUP_ENABLED!=='true'||!Number.isFinite(expiry)||expiry<=Date.now()||expiry>Date.now()+31*60000)return fail('SANDBOX_OPERATOR_DISABLED');
 const token=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1],expected=env.ARCHON_SANDBOX_SETUP_TOKEN_SHA256;
 if(!token||!/^[a-f0-9]{64}$/.test(expected??'')||!timingSafeEqual(createHash('sha256').update(token).digest(),Buffer.from(expected,'hex')))return fail('SANDBOX_OPERATOR_UNAUTHORIZED');
 if(request.method!=='POST'||request.headers.get('content-type')!=='application/json'||Number(request.headers.get('content-length'))>1024)return fail('SANDBOX_OPERATOR_REQUEST_INVALID',400);
 try {
  const text=await request.text();if(text.length>1024)return fail('SANDBOX_OPERATOR_REQUEST_INVALID',400);
  const body=JSON.parse(text);
  if(!body||Object.keys(body).length!==1||!['ACTIVATE_LEDGER','PROBE_RESOURCES','PROBE_ARTIFACTS','PREPARE_REVIEWED_INPUT','PREPARE_SUBMISSION_REVIEW','PROBE_TRANSPORT'].includes(body.operation))return fail('SANDBOX_OPERATOR_REQUEST_INVALID',400);
  const action=body.operation==='ACTIVATE_LEDGER'?activate:body.operation==='PROBE_ARTIFACTS'?artifacts:body.operation==='PREPARE_REVIEWED_INPUT'?prepareInput:body.operation==='PREPARE_SUBMISSION_REVIEW'?review:body.operation==='PROBE_TRANSPORT'?transport:probe;
  if(typeof action!=='function')return fail('SANDBOX_OPERATOR_ACTION_UNAVAILABLE',503);
  return Response.json(await action(),{headers:{'Cache-Control':'no-store'}});
 }catch(error){return fail(/^SANDBOX_[A-Z0-9_]+$/.test(error.message)?error.message:'SANDBOX_OPERATOR_FAILED',502);}
}
