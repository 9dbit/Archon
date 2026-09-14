import {existsSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createValidatorActivityPlan} from './prepare-validator-activity.mjs';

const base='https://developer.api.autodesk.com/da/us-east/v3',namespacePattern=/^[A-Za-z0-9_-]+$/;
export async function provisionValidatorActivity({namespace,apply=false,env=process.env,fetcher=fetch}={}){
 if(!namespacePattern.test(namespace??''))throw Error('VALIDATOR_ACTIVITY_NAMESPACE_INVALID');
 const plan=createValidatorActivityPlan(namespace);
 if(!apply)return {state:'VALIDATOR_ACTIVITY_DRY_RUN',namespace,engine:plan.engine,activity:plan.activity,alias:plan.alias,activityId:plan.activityId,appBundleId:plan.appbundles[0],executionEnabled:false,approvalGranted:false,reconciliation:'PROPOSE_CHANGESET_ONLY'};
 if(!env.APS_CLIENT_ID||!env.APS_CLIENT_SECRET)throw Error('VALIDATOR_ACTIVITY_CREDENTIALS_REQUIRED');
 const request=async(url,options={})=>{try{return await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(120000)});}catch{throw Error('VALIDATOR_ACTIVITY_REQUEST_FAILED');}};
 const auth=await request('https://developer.api.autodesk.com/authentication/v2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.APS_CLIENT_ID,client_secret:env.APS_CLIENT_SECRET,grant_type:'client_credentials',scope:'code:all'}).toString()});
 if(!auth.ok)throw Error('VALIDATOR_ACTIVITY_OAUTH_HTTP_'+auth.status);let authBody;try{authBody=await auth.json();}catch{throw Error('VALIDATOR_ACTIVITY_OAUTH_INVALID');}
 const token=authBody?.access_token;if(typeof token!=='string'||!token)throw Error('VALIDATOR_ACTIVITY_OAUTH_INVALID');
 const api=async(path,method='GET',body)=>{const response=await request(base+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});if(!response.ok)throw Error('VALIDATOR_ACTIVITY_'+method+'_HTTP_'+response.status);try{return response.status===204?null:await response.json();}catch{throw Error('VALIDATOR_ACTIVITY_RESPONSE_INVALID');}};
 const own=await api('/forgeapps/me'),actual=typeof own==='string'?own:own?.nickname;if(actual!==namespace)throw Error('VALIDATOR_ACTIVITY_NAMESPACE_MISMATCH');
 await api('/engines/'+encodeURIComponent(plan.engine));
 const bundleAlias=await api('/appbundles/ArchonLayoutBundle/aliases/'+plan.alias);
 if(!Number.isInteger(bundleAlias?.version)||bundleAlias.version<1)throw Error('VALIDATOR_ACTIVITY_BUNDLE_ALIAS_REQUIRED');
 const existing=await request(base+'/activities/'+plan.activity+'/aliases',{headers:{Authorization:'Bearer '+token}});
 if(existing.status!==404)throw Error('VALIDATOR_ACTIVITY_PREFLIGHT_REQUIRES_ABSENT_ACTIVITY');
 const spec={id:plan.activity,engine:plan.engine,appbundles:plan.appbundles,commandLine:plan.commandLine,parameters:plan.parameters,settings:plan.settings};
 const created=await api('/activities','POST',spec);
 if(!Number.isInteger(created?.version)||created.version<1)throw Error('VALIDATOR_ACTIVITY_VERSION_INVALID');
 await api('/activities/'+plan.activity+'/aliases','POST',{id:plan.alias,version:created.version});
 const alias=await api('/activities/'+plan.activity+'/aliases/'+plan.alias);
 if(alias?.version!==created.version)throw Error('VALIDATOR_ACTIVITY_ALIAS_VERIFICATION_FAILED');
 const readback=await api('/activities/'+encodeURIComponent(plan.activityId));
 if(readback.engine!==plan.engine||JSON.stringify(readback.appbundles)!==JSON.stringify(plan.appbundles)||JSON.stringify(readback.commandLine)!==JSON.stringify(plan.commandLine)||readback.settings?.script?.value!==plan.settings.script.value)throw Error('VALIDATOR_ACTIVITY_READBACK_MISMATCH');
 for(const [key,value] of Object.entries(plan.parameters)){if(readback.parameters?.[key]?.verb!==value.verb||readback.parameters?.[key]?.localName!==value.localName||readback.parameters?.[key]?.required!==true)throw Error('VALIDATOR_ACTIVITY_PARAMETER_MISMATCH');}
 return {state:'VALIDATOR_ACTIVITY_VERIFIED',namespace,engine:plan.engine,activity:plan.activity,alias:plan.alias,activityId:plan.activityId,appBundleId:plan.appbundles[0],appBundleVersion:bundleAlias.version,activityVersion:created.version,railway:{APS_VALIDATOR_ACTIVITY_ID:plan.activityId},executionEnabled:false,approvalGranted:false,reconciliation:'PROPOSE_CHANGESET_ONLY'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const [namespace,flag]=process.argv.slice(2);if(existsSync('archon-aps-validator-activity-result.json'))throw Error('Archive previous validator provisioning result before starting.');if(flag&&flag!=='--apply')throw Error('Only --apply is supported; default is offline dry-run.');const result=await provisionValidatorActivity({namespace,apply:flag==='--apply'});writeFileSync('archon-aps-validator-activity-result.json',JSON.stringify(result,null,2),{flag:'wx'});console.log(result.state+'; execution disabled.');}
 catch(error){console.error(error.message);process.exitCode=1;}
}
