import {createHmac,timingSafeEqual} from 'node:crypto';
const verified=new WeakSet();
const context='ARCHON_ISOLATED_SANDBOX_EXECUTION_V1';
const key=value=>{if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw Error('SANDBOX_APPROVAL_KEY_REQUIRED');return Buffer.from(value,'hex');};
const valid=(grant,now)=>grant?.context===context&&/^[A-Za-z0-9_-]{1,80}$/.test(grant.runId??'')&&/^[a-f0-9]{64}$/.test(grant.manifestSha256??'')&&/^[A-Za-z0-9_-]{1,128}$/.test(grant.reference??'')&&Number.isFinite(grant.issuedAt)&&Number.isFinite(grant.expiresAt)&&grant.issuedAt<=now&&grant.expiresAt>now&&grant.expiresAt>grant.issuedAt&&grant.expiresAt-grant.issuedAt<=60*60000;
// Trusted operator boundary ONLY, after explicit human execution approval.
// No HTTP issuance route or production caller exists. A token grants only this synthetic run.
export function issueSandboxApproval({runId,manifestSha256,reference,expiresAt,secret,now=Date.now}){
 const grant={context,runId,manifestSha256,reference,issuedAt:now(),expiresAt};
 if(!valid(grant,now()))throw Error('SANDBOX_APPROVAL_INVALID');
 const payload=Buffer.from(JSON.stringify(grant)).toString('base64url');
 return payload+'.'+createHmac('sha256',key(secret)).update(payload).digest('hex');
}
export function verifySandboxApproval({token,secret,runId,manifestSha256,now=Date.now}){
 if(typeof token!=='string'||token.length>2048||!/^([A-Za-z0-9_-]+)\.([a-f0-9]{64})$/.test(token))throw Error('SANDBOX_EXPLICIT_APPROVAL_REQUIRED');
 const [payload,signature]=token.split('.');
 const expected=createHmac('sha256',key(secret)).update(payload).digest();
 if(!timingSafeEqual(expected,Buffer.from(signature,'hex')))throw Error('SANDBOX_EXPLICIT_APPROVAL_REQUIRED');
 let grant;try{grant=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));}catch{throw Error('SANDBOX_EXPLICIT_APPROVAL_REQUIRED');}
 if(!valid(grant,now())||grant.runId!==runId||grant.manifestSha256!==manifestSha256)throw Error('SANDBOX_EXPLICIT_APPROVAL_REQUIRED');
 const result=Object.freeze({...grant});verified.add(result);return result;
}
export const isVerifiedSandboxApproval=grant=>verified.has(grant);
