// Server-only: never export tokens through an HTTP response.
export type ApsConfig = { clientId?: string; clientSecret?: string; callbackUrl?: string; engineId?: string; activityId?: string; appBundleId?: string };
export function getApsConfig(): ApsConfig {
  return { clientId: process.env.APS_CLIENT_ID, clientSecret: process.env.APS_CLIENT_SECRET,
    callbackUrl: process.env.APS_CALLBACK_URL, engineId: process.env.APS_AUTOCAD_ENGINE,
    activityId: process.env.APS_ACTIVITY_ID, appBundleId: process.env.APS_APPBUNDLE_ID };
}
export function getApsDiagnostics(config = getApsConfig()) {
  const required = { APS_CLIENT_ID: config.clientId, APS_CLIENT_SECRET: config.clientSecret,
    APS_AUTOCAD_ENGINE: config.engineId, APS_ACTIVITY_ID: config.activityId, APS_APPBUNDLE_ID: config.appBundleId };
  return { authFlow: 'CLIENT_CREDENTIALS', scope: 'code:all', region: 'us-east',
    missing: Object.entries(required).filter(([, value]) => !value?.trim()).map(([key]) => key),
    handshake: 'NOT_PROBED', executionEnabled: false, pipeline: 'SKELETON_ONLY',
    callbackRequiredForAutomation: false };
}
const host = 'https://developer.api.autodesk.com';
type Fetcher = typeof fetch;
export class ApsAuthService {
  private cached: { value: string; expiresAt: number } | undefined;
  private pending: Promise<string> | undefined;
  constructor(private readonly config: ApsConfig, private readonly request: Fetcher = fetch, private readonly now = Date.now) {}
  invalidate() { this.cached = undefined; }
  async getToken(): Promise<string> {
    if (!this.config.clientId?.trim() || !this.config.clientSecret?.trim()) throw new Error('APS_CREDENTIALS_MISSING');
    if (this.cached && this.cached.expiresAt > this.now() + 60000) return this.cached.value;
    if (this.pending) return this.pending;
    this.pending = this.acquire();
    try { return await this.pending; } finally { this.pending = undefined; }
  }
  private async acquire(): Promise<string> {
    const startedAt = this.now();
    const response = await this.request(host + '/authentication/v2/token', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(this.config.clientId + ':' + this.config.clientSecret).toString('base64') },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'code:all' }).toString()
    });
    if (!response.ok) throw new Error('APS_AUTH_HTTP_' + response.status);
    let body: unknown;
    try { body = await response.json(); } catch { throw new Error('APS_TOKEN_INVALID'); }
    const token = body as { access_token?: unknown; token_type?: unknown; expires_in?: unknown } | null;
    if (!token || typeof token.access_token !== 'string' || !token.access_token.trim() ||
      typeof token.token_type !== 'string' || token.token_type.toLowerCase() !== 'bearer' ||
      typeof token.expires_in !== 'number' || !Number.isFinite(token.expires_in) || token.expires_in <= 60) throw new Error('APS_TOKEN_INVALID');
    this.cached = { value: token.access_token, expiresAt: startedAt + token.expires_in * 1000 };
    return this.cached.value;
  }
}
export class ApsAutomationService {
  constructor(private readonly config: ApsConfig, private readonly auth: ApsAuthService, private readonly request: Fetcher = fetch) {}
  // Read-only discovery needs credentials only, not pre-created ARCHON resources.
  async discover(): Promise<ApsDiscovery> {
    let authVerified = false;
    try {
      const token = await this.auth.getToken();
      authVerified = true;
      const engines: string[] = [];
      let page: string | undefined;
      for (let index = 0; index < 5; index++) {
        const result = await this.read('/engines' + (page ? '?page=' + encodeURIComponent(page) : ''), token);
        if (!Array.isArray(result.data) || !result.data.every(value => typeof value === 'string')) throw new Error('APS_RESOURCE_INVALID');
        engines.push(...result.data.filter((value: string) => /^Autodesk\.AutoCAD\+[A-Za-z0-9_.-]+$/.test(value)));
        if (result.paginationToken != null && typeof result.paginationToken !== 'string') throw new Error('APS_RESOURCE_INVALID');
        page = result.paginationToken as string | undefined;
        if (!page) break;
        if (index === 4) throw new Error('APS_DISCOVERY_PAGE_LIMIT');
      }
      const bundles = await this.read('/appbundles', token);
      const activities = await this.read('/activities', token);
      if (!Array.isArray(bundles.data) || !Array.isArray(activities.data) ||
        !bundles.data.every(value => typeof value === 'string') || !activities.data.every(value => typeof value === 'string')) throw new Error('APS_RESOURCE_INVALID');
      const autoCadEngines = [...new Set(engines)].sort();
      return { state: autoCadEngines.length ? 'VERIFIED' : 'FAILED', authVerified, automationVerified: autoCadEngines.length > 0,
        autoCadEngines, appBundleCount: bundles.data.length, activityCount: activities.data.length,
        resourceCountsPartial: Boolean(bundles.paginationToken || activities.paginationToken),
        diagnostics: [autoCadEngines.length ? 'APS_AUTH_AND_AUTOCAD_ACCESS_VERIFIED' : 'APS_AUTOCAD_ENGINE_UNAVAILABLE'],
        executionEnabled: false };
    } catch (cause) {
      const code = cause instanceof Error && /^APS_[A-Z_]+(?:_[0-9]+)?$/.test(cause.message) ? cause.message : 'APS_CONNECTION_FAILED';
      return { state: 'FAILED', authVerified, automationVerified: false, autoCadEngines: [],
        diagnostics: [code], executionEnabled: false };
    }
  }
  // Explicit server-side call only; never invoked by public status GET.
  async handshake() {
    if (getApsDiagnostics(this.config).missing.length) return { verified: false, executionEnabled: false, diagnostics: ['APS_CONFIGURATION_MISSING'] };
    try {
      const token = await this.auth.getToken();
      const engineId = this.config.engineId!;
      if (!/^Autodesk\.AutoCAD\+[A-Za-z0-9_.-]+$/.test(engineId)) throw new Error('APS_ENGINE_INVALID');
      const activity = await this.read('/activities/' + encodeURIComponent(this.config.activityId!), token);
      const bundle = await this.read('/appbundles/' + encodeURIComponent(this.config.appBundleId!), token);
      await this.read('/engines/' + encodeURIComponent(engineId), token);
      if (activity.engine !== engineId || bundle.engine !== engineId ||
        !Array.isArray(activity.appbundles) || !activity.appbundles.includes(this.config.appBundleId)) throw new Error('APS_RESOURCE_MISMATCH');
      return { verified: true, executionEnabled: false, diagnostics: ['APS_AUTH_AND_RESOURCES_VERIFIED', 'DWG_EXECUTION_GATE_CLOSED'] };
    } catch (cause) {
      const code = cause instanceof Error && /^APS_[A-Z_]+(?:_[0-9]+)?$/.test(cause.message) ? cause.message : 'APS_HANDSHAKE_FAILED';
      return { verified: false, executionEnabled: false, diagnostics: [code] };
    }
  }
  private async read(path: string, token: string): Promise<Record<string, unknown>> {
    const response = await this.request(host + '/da/us-east/v3' + path, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10000), headers: { Authorization: 'Bearer ' + token }
    });
    if (!response.ok) { if (response.status === 401) this.auth.invalidate(); throw new Error('APS_AUTOMATION_HTTP_' + response.status); }
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('APS_RESOURCE_INVALID');
    return value as Record<string, unknown>;
  }
  async submitWorkItem(_plan: DwgPipelinePlan): Promise<never> { throw new Error('APS_DWG_EXECUTION_DISABLED'); }
}
export type DwgPipelinePlan = {
  jobId: string; source: { mode: 'PREVIEW' | 'APPROVED_VERSION'; versionId: string; changeSetId?: string };
  units: 'mm'; activityId?: string; appBundleId?: string; engineId?: string;
  layers: Record<'siteBoundary' | 'walls' | 'roomLabels' | 'dimensions', string>;
  stages: readonly string[]; executionEnabled: false; reconciliation: 'PROPOSE_CHANGESET_ONLY';
};
// A plan describes the future transport; it grants no approval or execution authority.
export function createDwgPipelinePlan(jobId: string, source: DwgPipelinePlan['source'], config = getApsConfig()): DwgPipelinePlan {
  if (!jobId.trim() || !source.versionId.trim() || !['PREVIEW', 'APPROVED_VERSION'].includes(source.mode)) throw new Error('APS_SOURCE_VERSION_REQUIRED');
  return { jobId, source: { ...source }, units: 'mm', activityId: config.activityId, appBundleId: config.appBundleId,
    engineId: config.engineId, layers: { siteBoundary: 'ARCHON_SITE', walls: 'ARCHON_WALLS', roomLabels: 'ARCHON_ROOMS', dimensions: 'ARCHON_DIMS' },
    stages: ['VALIDATE_SOURCE', 'SERIALIZE_GEOMETRY', 'SANDBOX_INPUT', 'WORKITEM_BLOCKED', 'VERIFY_DWG_ARTIFACT', 'RECONCILIATION_DIFF', 'REVIEW_CHECKLIST'],
    executionEnabled: false, reconciliation: 'PROPOSE_CHANGESET_ONLY' };
}

export type ApsDiscovery = {
  state: 'NOT_PROBED' | 'PROBING' | 'VERIFIED' | 'FAILED';
  authVerified: boolean; automationVerified: boolean; autoCadEngines: string[];
  appBundleCount?: number; activityCount?: number; resourceCountsPartial?: boolean;
  diagnostics: string[]; executionEnabled: false; checkedAt?: string;
  resourceHandshakeVerified?: boolean;
};
type ConnectionRuntime = { result: ApsDiscovery; pending?: Promise<void> };
const runtimeGlobal = globalThis as typeof globalThis & { __archonApsConnection?: ConnectionRuntime };
function connectionRuntime(): ConnectionRuntime {
  return runtimeGlobal.__archonApsConnection ??= { result: {
    state: 'NOT_PROBED', authVerified: false, automationVerified: false,
    autoCadEngines: [], diagnostics: [], executionEnabled: false } };
}
// Pure snapshot: public status polling never initiates provider requests.
export function getApsConnectionStatus(): ApsDiscovery {
  const result = connectionRuntime().result;
  return { ...result, autoCadEngines: [...result.autoCadEngines], diagnostics: [...result.diagnostics] };
}
// Once per Node server process. Tokens stay in the local auth instance, never in global/public state.
export async function startApsConnectionProbe(config = getApsConfig(), request: Fetcher = fetch): Promise<void> {
  const runtime = connectionRuntime();
  if (runtime.pending) return runtime.pending;
  if (runtime.result.state !== 'NOT_PROBED') return;
  runtime.result = { ...runtime.result, state: 'PROBING' };
  runtime.pending = (async () => {
    const service = new ApsAutomationService(config, new ApsAuthService(config, request), request);
    const result = await service.discover();
    if (result.automationVerified && !getApsDiagnostics(config).missing.length) {
      const handshake = await service.handshake();
      result.resourceHandshakeVerified = handshake.verified;
      result.diagnostics.push(...handshake.diagnostics);
    }
    runtime.result = { ...result, checkedAt: new Date().toISOString() };
  })();
  try { await runtime.pending; } finally { runtime.pending = undefined; }
}
