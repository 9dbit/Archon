// Read-only Autodesk Platform Services Revit Automation discovery.
// This module never creates AppBundles, Activities, WorkItems, or changes any model.
// Credentials are intentionally separate from the legacy AutoCAD worker.
const AUTH_URL = 'https://developer.api.autodesk.com/authentication/v2/token';
const ENGINES_URL = 'https://developer.api.autodesk.com/da/us-east/v3/engines';
const REVIT_ENGINE = /^Autodesk\.Revit\+[A-Za-z0-9_.-]+$/;
const MAX_PAGES = 5;

export function getRevitApsConfig(env = process.env) {
  return {
    clientId: env.ARCHON_REVIT_APS_CLIENT_ID,
    clientSecret: env.ARCHON_REVIT_APS_CLIENT_SECRET
  };
}

function snapshot(state, diagnostic, { authVerified = false, automationApiVerified = false, engines = [], pagesRead = 0 } = {}) {
  const revitEngines = [...new Set(engines)].sort();
  return {
    state,
    authVerified,
    automationApiVerified,
    revitAvailable: revitEngines.length > 0,
    revitEngines,
    pagesRead,
    diagnostics: [diagnostic],
    executionEnabled: false
  };
}

class DiscoveryError extends Error {
  constructor(code) {
    super(code);
    this.name = 'DiscoveryError';
  }
}

function safeError(error) {
  return error instanceof DiscoveryError ? error.message : 'APS_CONNECTION_FAILED';
}

async function jsonRequest(url, options, fetcher) {
  let response;
  try {
    response = await fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(10000) });
  } catch {
    throw new DiscoveryError('APS_NETWORK_FAILURE');
  }
  if (!response?.ok) {
    const status = Number.isInteger(response?.status) && response.status >= 100 && response.status <= 599
      ? response.status : 0;
    throw new DiscoveryError((url === AUTH_URL ? 'APS_AUTH_HTTP_' : 'APS_AUTOMATION_HTTP_') + status);
  }
  try {
    return await response.json();
  } catch {
    throw new DiscoveryError('APS_RESPONSE_INVALID');
  }
}

async function getToken(config, fetcher) {
  const basic = Buffer.from(config.clientId + ':' + config.clientSecret).toString('base64');
  const payload = await jsonRequest(AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + basic
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'code:all' }).toString()
  }, fetcher);
  if (!payload || typeof payload.access_token !== 'string' || !payload.access_token.trim() ||
      typeof payload.token_type !== 'string' || payload.token_type.toLowerCase() !== 'bearer' ||
      typeof payload.expires_in !== 'number' || !Number.isFinite(payload.expires_in) || payload.expires_in <= 0) {
    throw new DiscoveryError('APS_TOKEN_INVALID');
  }
  return payload.access_token;
}

/**
 * Authenticate a dedicated Revit APS app and discover public Revit engine IDs.
 * Provider tokens, secrets and raw error bodies never escape this function.
 * Only token creation (POST /authentication/v2/token) and GET /engines occur.
 */
export async function discoverRevitAccess(config = getRevitApsConfig(), fetcher = fetch) {
  if (!config?.clientId?.trim() || !config?.clientSecret?.trim()) {
    return snapshot('NOT_CONFIGURED', 'APS_REVIT_CREDENTIALS_MISSING');
  }

  let token;
  try {
    token = await getToken(config, fetcher);
  } catch (error) {
    return snapshot('FAILED', safeError(error));
  }

  const engines = [];
  let page;
  let pagesRead = 0;
  const visited = new Set();
  try {
    for (let i = 0; i < MAX_PAGES; i++) {
      const url = ENGINES_URL + (page ? '?page=' + encodeURIComponent(page) : '');
      const response = await jsonRequest(url, {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token }
      }, fetcher);
      pagesRead++;
      if (!response || !Array.isArray(response.data) ||
          !response.data.every(value => typeof value === 'string')) {
        throw new DiscoveryError('APS_ENGINES_RESPONSE_INVALID');
      }
      engines.push(...response.data.filter(id => REVIT_ENGINE.test(id)));
      const next = response.paginationToken;
      if (next == null || next === '') {
        const options = { authVerified: true, automationApiVerified: true, engines, pagesRead };
        return engines.length
          ? snapshot('VERIFIED', 'APS_REVIT_ENGINE_VERIFIED', options)
          : snapshot('REVIT_UNAVAILABLE', 'APS_REVIT_ENGINE_UNAVAILABLE', options);
      }
      if (typeof next !== 'string' || visited.has(next)) {
        throw new DiscoveryError('APS_PAGINATION_INVALID');
      }
      visited.add(next);
      page = next;
    }
    throw new DiscoveryError('APS_DISCOVERY_PAGE_LIMIT');
  } catch (error) {
    // Reject incomplete enumeration rather than claiming that partial results prove access.
    return snapshot('FAILED', safeError(error), { authVerified: true, pagesRead });
  }
}
