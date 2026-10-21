import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discoverRevitAccess, getRevitApsConfig } from './discovery.mjs';

const credentials = { clientId: 'new-app-id', clientSecret: 'private-new-app-secret' };
const tokenBody = { access_token: 'very-private-access-token', token_type: 'Bearer', expires_in: 3600 };
const oauth = () => Response.json(tokenBody);
const page = (data, paginationToken) => Response.json({ data, ...(paginationToken ? { paginationToken } : {}) });

test('reads only dedicated Revit variables; does not inherit legacy AutoCAD credentials', async () => {
  const config = getRevitApsConfig({
    APS_CLIENT_ID: 'old-autocad-id',
    APS_CLIENT_SECRET: 'old-autocad-secret'
  });
  assert.deepEqual(config, { clientId: undefined, clientSecret: undefined });
  let calls = 0;
  const result = await discoverRevitAccess(config, () => { calls++; throw Error('must not connect'); });
  assert.equal(calls, 0);
  assert.equal(result.state, 'NOT_CONFIGURED');
  assert.equal(result.executionEnabled, false);
});

test('OAuth token and paginated Revit engines are verified with no write operations', async () => {
  const calls = [];
  const result = await discoverRevitAccess(credentials, async (url, options) => {
    calls.push({ url, method: options.method, scope: options.body });
    if (url.endsWith('/authentication/v2/token')) {
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.Authorization, 'Basic ' +
        Buffer.from('new-app-id:private-new-app-secret').toString('base64'));
      return oauth();
    }
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.Authorization, 'Bearer very-private-access-token');
    if (url.endsWith('/engines')) return page(['Autodesk.AutoCAD+24_3', 'Autodesk.Revit+2026'], 'next-page');
    if (url.includes('page=next-page')) return page(['Autodesk.Revit+2025', 'Autodesk.Revit+2026']);
    throw Error('unexpected endpoint');
  });
  assert.equal(result.state, 'VERIFIED');
  assert.equal(result.authVerified, true);
  assert.equal(result.automationApiVerified, true);
  assert.deepEqual(result.revitEngines, ['Autodesk.Revit+2025', 'Autodesk.Revit+2026']);
  assert.equal(result.pagesRead, 2);
  assert.equal(result.executionEnabled, false);
  assert.deepEqual(calls.map(call => call.method), ['POST', 'GET', 'GET']);
  assert.equal(calls[0].scope, 'grant_type=client_credentials&scope=code%3Aall');
  for (const request of calls.slice(1)) {
    assert.equal(request.url.includes('/workitems'), false);
    assert.equal(request.url.includes('/activities'), false);
    assert.equal(request.url.includes('/appbundles'), false);
  }
  assert.equal(JSON.stringify(result).includes('private'), false);
  assert.equal(JSON.stringify(result).includes('new-app-id'), false);
});

test('missing credentials and failed token never query engines', async () => {
  let calls = 0;
  const none = await discoverRevitAccess({}, () => { calls++; throw Error('unexpected'); });
  assert.equal(none.state, 'NOT_CONFIGURED');
  assert.equal(calls, 0);
  const denied = await discoverRevitAccess(credentials, async () => {
    calls++;
    return new Response('secret error body', { status: 401 });
  });
  assert.deepEqual(denied.diagnostics, ['APS_AUTH_HTTP_401']);
  assert.equal(denied.authVerified, false);
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(denied).includes('secret error body'), false);
});

test('separates successful authentication from Automation 403', async () => {
  const result = await discoverRevitAccess(credentials, async url =>
    url.endsWith('/token') ? oauth() : new Response('forbidden private body', { status: 403 }));
  assert.equal(result.state, 'FAILED');
  assert.equal(result.authVerified, true);
  assert.equal(result.automationApiVerified, false);
  assert.deepEqual(result.diagnostics, ['APS_AUTOMATION_HTTP_403']);
  assert.equal(JSON.stringify(result).includes('forbidden private body'), false);
});

test('valid engine response with no Revit reports unavailable, not success', async () => {
  const result = await discoverRevitAccess(credentials, async url =>
    url.endsWith('/token') ? oauth() : page(['Autodesk.AutoCAD+24_3']));
  assert.equal(result.state, 'REVIT_UNAVAILABLE');
  assert.equal(result.authVerified, true);
  assert.equal(result.automationApiVerified, true);
  assert.equal(result.revitAvailable, false);
});

test('invalid token, malformed engine data and network exceptions fail closed', async () => {
  const badToken = await discoverRevitAccess(credentials, async () =>
    Response.json({ access_token: 'invalid', token_type: 'Basic', expires_in: 3600 }));
  assert.deepEqual(badToken.diagnostics, ['APS_TOKEN_INVALID']);
  const invalidEngines = await discoverRevitAccess(credentials, async url =>
    url.endsWith('/token') ? oauth() : page([{ bad: 'object' }]));
  assert.deepEqual(invalidEngines.diagnostics, ['APS_ENGINES_RESPONSE_INVALID']);
  const networkFailure = await discoverRevitAccess(credentials, async () => { throw Error('credential detail'); });
  assert.deepEqual(networkFailure.diagnostics, ['APS_NETWORK_FAILURE']);
  for (const result of [badToken, invalidEngines, networkFailure]) {
    assert.equal(result.executionEnabled, false);
    assert.equal(result.revitAvailable, false);
    assert.equal(JSON.stringify(result).includes('credential detail'), false);
  }
});

test('pagination loops and page cap cannot yield a false positive', async () => {
  const repeated = await discoverRevitAccess(credentials, async url =>
    url.endsWith('/token') ? oauth() : page(['Autodesk.Revit+2026'], 'loop'));
  assert.deepEqual(repeated.diagnostics, ['APS_PAGINATION_INVALID']);
  assert.equal(repeated.revitAvailable, false);
  let count = 0;
  const capped = await discoverRevitAccess(credentials, async url =>
    url.endsWith('/token') ? oauth() : page(['Autodesk.Revit+2026'], 'more-' + ++count));
  assert.deepEqual(capped.diagnostics, ['APS_DISCOVERY_PAGE_LIMIT']);
  assert.equal(capped.pagesRead, 5);
  assert.equal(capped.revitAvailable, false);
});
