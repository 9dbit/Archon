import type { ArchonEngineAdapter, EngineCapability, EngineJob, EngineJobResult } from '@archon/domain';

export type AutoCadAdapterConfig = {
  clientId?: string;
  clientSecret?: string;
  callbackUrl?: string;
};

export type AutoCadAdapterStatus = {
  id: 'autocad';
  label: 'AutoCAD / Autodesk APS';
  health: 'READY' | 'DEGRADED' | 'OFFLINE';
  configured: boolean;
  missing: string[];
  capabilities: EngineCapability[];
  mode: 'APS_AUTOMATION';
  nextAction: string;
};

const capabilities: EngineCapability[] = ['2D_DRAFTING', 'DRAWING_GENERATION', 'MODEL_EXCHANGE'];

export function getAutoCadAdapterConfig(): AutoCadAdapterConfig {
  return {
    clientId: process.env.APS_CLIENT_ID,
    clientSecret: process.env.APS_CLIENT_SECRET,
    callbackUrl: process.env.APS_CALLBACK_URL
  };
}

export function getAutoCadAdapterStatus(config = getAutoCadAdapterConfig()): AutoCadAdapterStatus {
  const missing = [
    !config.clientId ? 'APS_CLIENT_ID' : null,
    !config.clientSecret ? 'APS_CLIENT_SECRET' : null,
    !config.callbackUrl ? 'APS_CALLBACK_URL' : null
  ].filter((value): value is string => Boolean(value));
  return {
    id: 'autocad',
    label: 'AutoCAD / Autodesk APS',
    health: missing.length ? 'OFFLINE' : 'DEGRADED',
    configured: missing.length === 0,
    missing,
    capabilities,
    mode: 'APS_AUTOMATION',
    nextAction: missing.length ? `Configure ${missing.join(', ')}` : 'Run APS OAuth handshake and Automation API capability probe.'
  };
}

export class AutoCadApsAdapter implements ArchonEngineAdapter {
  readonly id = 'autocad';
  readonly label = 'AutoCAD / Autodesk APS';
  readonly capabilities = capabilities;

  async health(): Promise<'READY' | 'DEGRADED' | 'OFFLINE'> {
    return getAutoCadAdapterStatus().health;
  }

  async preview(job: EngineJob): Promise<EngineJobResult> {
    const status = getAutoCadAdapterStatus();
    return {
      jobId: job.id,
      status: status.configured ? 'QUEUED' : 'FAILED',
      outputArtifactIds: [],
      diagnostics: [status.configured ? 'AutoCAD APS preview transport is scaffolded; remote execution is not enabled until OAuth handshake succeeds.' : status.nextAction]
    };
  }

  async execute(job: EngineJob): Promise<EngineJobResult> {
    const status = getAutoCadAdapterStatus();
    return {
      jobId: job.id,
      status: 'FAILED',
      outputArtifactIds: [],
      diagnostics: [status.configured ? 'AutoCAD APS execution intentionally blocked until E8.2 OAuth and Automation handshake validation.' : status.nextAction]
    };
  }

  async reconcile(job: EngineJob, result: EngineJobResult): Promise<EngineJobResult> {
    return {
      ...result,
      diagnostics: [...result.diagnostics, `ARCHON reconciliation boundary preserved for ${job.changeSetId}; no external result mutates approved canonical state automatically.`]
    };
  }
}

export const autoCadAdapter = new AutoCadApsAdapter();
