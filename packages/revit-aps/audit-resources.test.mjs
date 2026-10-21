import test from 'node:test';
import assert from 'node:assert/strict';
import { auditRevitResources } from './audit-resources.mjs';

const config = {clientId: 'PRIVATE_CLIENT_ID', clientSecret: 'PRIVATE_CLIENT_SECRET'};
const expectedAuth = 'PRIVATE_ACCESS_TOKEN';
const ok = (body, status = 200) => ({ok:status >= 200 && status < 300,status,json:async()=>body});
function mock(overrides = {}) {
  const calls=[];
  const fetcher = async (url, options) => {
    calls.push({url,method:options.method,options});
    if(url.includes('authentication/v2/token')) return ok({
      access_token:expectedAuth,token_type:'Bearer',expires_in:3600
    });
    if(url.endsWith('/forgeapps/me')) return ok(overrides.namespace ?? {nickname:'archon_pilot'});
    if(url.endsWith('/aliases/%24LATEST')) {
      if(overrides.noBundle && url.includes('/appbundles/')) return ok({},404);
      if(overrides.noActivity && url.includes('/activities/')) return ok({},404);
      return ok({id:'$LATEST',version:2});
    }
    if(url.endsWith('/aliases/pilot_v1')) {
      if(overrides.missingAlias) return ok({},404);
      if(overrides.forbiddenAlias) return ok({},403);
      return ok({id:'pilot_v1',version:1});
    }
    throw new Error('Unexpected network endpoint');
  };
  return {calls,fetcher};
}

test('missing credentials never trigger fetch',async()=>{
  const m=mock();
  const r=await auditRevitResources({},m.fetcher);
  assert.equal(r.state,'NOT_CONFIGURED');
  assert.equal(m.calls.length,0);
  assert.equal(r.executionEnabled,false);
});

test('read-only probe finds existing AppBundle/Activity and aliases without leaking secrets',async()=>{
  const m=mock();
  const r=await auditRevitResources(config,m.fetcher);
  assert.equal(r.state,'VERIFIED');
  assert.equal(r.namespace,'archon_pilot');
  assert.equal(r.resources.appBundle.latestVersion,2);
  assert.equal(r.resources.activity.aliasVersion,1);
  assert.deepEqual(m.calls.map(c=>c.method),['POST','GET','GET','GET','GET','GET']);
  assert(m.calls.filter(c=>c.method==='GET').every(c=>c.url.includes('/forgeapps/me')||c.url.includes('/aliases/')));
  assert(m.calls.every(c=>c.options.redirect==='error'));
  assert.doesNotMatch(JSON.stringify(r),/PRIVATE_CLIENT|PRIVATE_ACCESS|Bearer|signature|package/i);
  assert.equal(r.provisioningEnabled,false);
  assert.equal(r.workitemsEnabled,false);
});

test('absent resource is explicitly classified; no unsafe registration follows',async()=>{
  const m=mock({noBundle:true,noActivity:true});
  const r=await auditRevitResources(config,m.fetcher);
  assert.equal(r.resources.appBundle.status,'NOT_FOUND');
  assert.equal(r.resources.activity.status,'NOT_FOUND');
  assert.equal(m.calls.filter(c=>c.method==='POST').length,1);
});

test('missing pilot alias is distinct from missing resource',async()=>{
  const m=mock({missingAlias:true});
  const r=await auditRevitResources(config,m.fetcher);
  assert.equal(r.state,'VERIFIED');
  assert.equal(r.resources.appBundle.status,'PRESENT');
  assert.equal(r.resources.appBundle.alias,'NOT_FOUND');
});

test('a 403 fails closed, without raw response or secrets',async()=>{
  const m=mock({forbiddenAlias:true});
  const r=await auditRevitResources(config,m.fetcher);
  assert.equal(r.state,'FAILED');
  assert.equal(r.diagnostics[0],'APS_AUDIT_APPBUNDLE_ALIAS_HTTP_403');
  assert.equal(r.workitemsEnabled,false);
});

test('invalid or absent namespace never authorizes provisioning',async()=>{
  for(const bad of [{nickname:'my-unsafe-namespace'},{nickname:''},{nickname:'a'.repeat(21)}]){
    const m=mock({namespace:bad});
    const r=await auditRevitResources(config,m.fetcher);
    assert.equal(r.state,'NICKNAME_REVIEW_REQUIRED');
    assert.equal(r.namespace,null);
    assert.equal(r.provisioningEnabled,false);
  }
});
