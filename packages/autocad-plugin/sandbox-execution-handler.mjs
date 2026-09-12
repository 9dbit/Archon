import {createHash,timingSafeEqual} from 'node:crypto';
const leases=new Set();
export async function handleSandboxExecution(request,{env=process.env,execute}={}){
 const fail=(error,status=403)=>Response.json({error,executionEnabled:false},{status,headers:{'Cache-Control':'no-store'}});
 const expires=Number(env.ARCHON_SANDBOX_EXECUTION_EXPIRES_AT),now=Date.now();
 if(env.ARCHON_SANDBOX_EXECUTION_ENABLED!=='true'||!Number.isFinite(expires)||expires<=now||expires>now+31*60000)return fail('SANDBOX_EXECUTION_DISABLED');
 const token=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1],expected=env.ARCHON_SANDBOX_EXECUTION_TOKEN_SHA256;
 if(!token||!/^[a-f0-9]{64}$/.test(expected??'')||!timingSafeEqual(createHash('sha256').update(token).digest(),Buffer.from(expected,'hex')))return fail('SANDBOX_EXECUTION_UNAUTHORIZED');
 if(request.method!=='POST'||request.headers.get('content-type')!=='application/json'||Number(request.headers.get('content-length'))>4096)return fail('SANDBOX_EXECUTION_REQUEST_INVALID',400);
 let body;try{const text=await request.text();if(text.length>4096)throw Error();body=JSON.parse(text);}catch{return fail('SANDBOX_EXECUTION_REQUEST_INVALID',400);}
 if(!body||Object.keys(body).length!==1||typeof body.approvalToken!=='string'||body.approvalToken.length>2048||!/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(body.approvalToken))return fail('SANDBOX_EXECUTION_REQUEST_INVALID',400);
 const lease=createHash('sha256').update(token).digest('hex');if(leases.has(lease))return fail('SANDBOX_EXECUTION_ALREADY_ATTEMPTED',409);leases.add(lease);
 if(typeof execute!=='function')return fail('SANDBOX_EXECUTION_UNAVAILABLE',503);
 try{return Response.json(await execute(body.approvalToken),{headers:{'Cache-Control':'no-store'}});}catch(error){return fail(/^SANDBOX_[A-Z0-9_]+$/.test(error.message)?error.message:'SANDBOX_EXECUTION_FAILED',502);}
}
