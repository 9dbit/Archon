import {createHash,timingSafeEqual} from 'node:crypto';
export async function handleSandboxFinalization(request,{env=process.env,finalize}={}){
 const fail=(error,status=403)=>Response.json({error,finalizationEnabled:false,approvalGranted:false},{status,headers:{'Cache-Control':'no-store'}});
 const expires=Number(env.ARCHON_SANDBOX_FINALIZATION_EXPIRES_AT),now=Date.now();
 if(env.ARCHON_SANDBOX_FINALIZATION_ENABLED!=='true'||!Number.isFinite(expires)||expires<=now||expires>now+31*60000)return fail('SANDBOX_FINALIZATION_DISABLED');
 const token=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1],expected=env.ARCHON_SANDBOX_FINALIZATION_TOKEN_SHA256;
 if(!token||!/^[a-f0-9]{64}$/.test(expected??'')||!timingSafeEqual(createHash('sha256').update(token).digest(),Buffer.from(expected,'hex')))return fail('SANDBOX_FINALIZATION_UNAUTHORIZED');
 if(request.method!=='POST'||request.headers.get('content-type')!=='application/json'||Number(request.headers.get('content-length'))>2)return fail('SANDBOX_FINALIZATION_REQUEST_INVALID',400);
 let body;try{const text=await request.text();if(text!=='{}')throw Error();body=JSON.parse(text);}catch{return fail('SANDBOX_FINALIZATION_REQUEST_INVALID',400);}
 if(!body||Object.keys(body).length!==0)return fail('SANDBOX_FINALIZATION_REQUEST_INVALID',400);
 if(typeof finalize!=='function')return fail('SANDBOX_FINALIZATION_UNAVAILABLE',503);
 try{return Response.json(await finalize(),{headers:{'Cache-Control':'no-store'}});}catch(error){return fail(/^SANDBOX_[A-Z0-9_]+$/.test(error.message)?error.message:'SANDBOX_FINALIZATION_FAILED',502);}
}
