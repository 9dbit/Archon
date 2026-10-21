// APS Automation resource inventory. Intentionally read-only except OAuth
// token issuance. No AppBundle, Activity, alias or WorkItem mutations exist.
const AUTH_URL = 'https://developer.api.autodesk.com/authentication/v2/token';
const API = 'https://developer.api.autodesk.com/da/us-east/v3';
const TARGETS = [
  ['appBundle', 'appbundles', 'ArchonRevitReadOnlyPilot'],
  ['activity', 'activities', 'ArchonRevitInspectModel']
];
const ALIAS = 'pilot_v1';
const NAMESPACE = /^[A-Za-z0-9_]{1,20}$/;

export function getAuditConfig(env = process.env) {
  return {
    clientId: env.ARCHON_REVIT_APS_CLIENT_ID,
    clientSecret: env.ARCHON_REVIT_APS_CLIENT_SECRET
  };
}

class AuditError extends Error {
  constructor(code) { super(code); this.name = 'AuditError'; }
}
function fail(code) { throw new AuditError(code); }

async function call(url, opts, fetcher, code) {
  let response;
  try {
    response = await fetcher(url, {
      ...opts, redirect: 'error', signal: AbortSignal.timeout(10000)
    });
  } catch {
    fail(code + '_NETWORK_FAILURE');
  }
  const status = Number.isInteger(response?.status) ? response.status : 0;
  if (status === 404 && opts.method === 'GET') return {notFound: true};
  if (!response?.ok) fail(code + '_HTTP_' + (status >= 100 && status <= 599 ? status : 0));
  let json;
  try { json = await response.json(); } catch { fail(code + '_RESPONSE_INVALID'); }
  return {data: json};
}
const locked = (state, diagnostics, extra = {}) => ({
  state, authVerified: false, automationApiVerified: false,
  ...extra,
  diagnostics: [diagnostics],
  executionEnabled: false,
  provisioningEnabled: false,
  workitemsEnabled: false
});

async function issueToken(config, fetcher) {
  const basic = Buffer.from(config.clientId + ':' + config.clientSecret).toString('base64');
  const result = await call(AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + basic
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'code:all'
    }).toString()
  }, fetcher, 'APS_AUDIT_AUTH');
  const payload = result.data;
  if (!payload || typeof payload.access_token !== 'string' ||
      !payload.access_token.trim() || payload.token_type?.toLowerCase() !== 'bearer') {
    fail('APS_AUDIT_TOKEN_INVALID');
  }
  return payload.access_token;
}

async function inspectTarget(category, id, token, fetcher, kind) {
  const auth = {method: 'GET', headers: {Authorization: 'Bearer ' + token}};
  // $LATEST is read-only per APS; the separate pilot alias is never patched.
  const base = API + '/' + category + '/' + id + '/aliases/';
  const latest = await call(base + '%24LATEST', auth, fetcher, 'APS_AUDIT_' + kind + '_LATEST');
  if (latest.notFound) {
    return {id, status: 'NOT_FOUND', alias: 'NOT_FOUND'};
  }
  const version = latest.data?.version;
  if (!Number.isInteger(version) || version < 1) {
    fail('APS_AUDIT_' + kind + '_LATEST_INVALID');
  }
  const pilot = await call(base + ALIAS, auth, fetcher, 'APS_AUDIT_' + kind + '_ALIAS');
  if (pilot.notFound) {
    return {id, status: 'PRESENT', latestVersion: version, alias: 'NOT_FOUND'};
  }
  const aliasVersion = pilot.data?.version;
  if (!Number.isInteger(aliasVersion) || aliasVersion < 1) {
    fail('APS_AUDIT_' + kind + '_ALIAS_INVALID');
  }
  return {id, status: 'PRESENT', latestVersion: version, alias: 'PRESENT', aliasVersion};
}

/**
 * Auth POST plus only GET /forgeapps/me and /aliases/$LATEST, /aliases/pilot_v1.
 * No raw provider response, tokens, secrets, URLs or headers are logged.
 */
export async function auditRevitResources(config = getAuditConfig(), fetcher = fetch) {
  if (!config?.clientId?.trim() || !config?.clientSecret?.trim()) {
    return locked('NOT_CONFIGURED', 'APS_REVIT_CREDENTIALS_MISSING');
  }
  let authVerified = false;
  try {
    const token = await issueToken(config, fetcher);
    authVerified = true;
    const nickname = await call(API + '/forgeapps/me', {
      method: 'GET',
      headers: {Authorization: 'Bearer ' + token}
    }, fetcher, 'APS_AUDIT_NICKNAME');
    if (nickname.notFound) fail('APS_AUDIT_NICKNAME_NOT_FOUND');
    const raw = nickname.data;
    const value = typeof raw === 'string' ? raw : raw?.nickname;
    // Do not expose the Client ID. A missing nickname is reported separately.
    const nicknameValid = typeof value === 'string' && NAMESPACE.test(value) &&
      value !== config.clientId;
    const resources = {};
    for (const [key, category, id] of TARGETS) {
      resources[key] = await inspectTarget(category, id, token, fetcher, key.toUpperCase());
    }
    return locked(nicknameValid ? 'VERIFIED' : 'NICKNAME_REVIEW_REQUIRED',
      nicknameValid ? 'APS_RESOURCE_AUDIT_READONLY' : 'APS_NICKNAME_NOT_CONFIGURED',
      {
        authVerified,
        automationApiVerified: true,
        namespace: nicknameValid ? value : null,
        resources
      });
  } catch (error) {
    return locked('FAILED',
      error instanceof AuditError ? error.message : 'APS_AUDIT_UNEXPECTED_FAILURE',
      {authVerified});
  }
}
