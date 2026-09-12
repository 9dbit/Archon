import type { ArchonEngineAdapter, EngineCapability, EngineJob, EngineJobResult } from '@archon/domain';
import { autoCadAdapter } from './autocad';
export { AutoCadApsAdapter, autoCadAdapter, getAutoCadAdapterConfig, getAutoCadAdapterStatus } from './autocad';
export type { AutoCadAdapterConfig, AutoCadAdapterStatus } from './autocad';

class MockAdapter implements ArchonEngineAdapter {
  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly capabilities: EngineCapability[]
  ) {}

  async health(): Promise<'READY' | 'DEGRADED' | 'OFFLINE'> {
    return 'READY';
  }

  async preview(job: EngineJob): Promise<EngineJobResult> {
    return {
      jobId: job.id,
      status: 'SUCCEEDED',
      outputArtifactIds: [],
      diagnostics: [`${this.label} mock preview completed`]
    };
  }

  async execute(job: EngineJob): Promise<EngineJobResult> {
    return {
      jobId: job.id,
      status: 'SUCCEEDED',
      outputArtifactIds: [],
      diagnostics: [`${this.label} mock execution completed`]
    };
  }

  async reconcile(job: EngineJob, result: EngineJobResult): Promise<EngineJobResult> {
    return {
      ...result,
      diagnostics: [...result.diagnostics, `${this.label} mock reconciliation completed for ${job.changeSetId}`]
    };
  }
}

export const engineAdapters = {
  autocad: autoCadAdapter,
  revit: new MockAdapter('revit', 'Revit', ['BIM_AUTHORING', 'DRAWING_GENERATION', 'MODEL_EXCHANGE']),
  sketchup: new MockAdapter('sketchup', 'SketchUp', ['3D_MODELING', 'MODEL_EXCHANGE']),
  rhino: new MockAdapter('rhino', 'Rhino / Grasshopper', ['PARAMETRIC_GEOMETRY', '3D_MODELING', 'MODEL_EXCHANGE']),
  blender: new MockAdapter('blender', 'Blender', ['3D_MODELING', 'RENDERING', 'MODEL_EXCHANGE']),
  vray: new MockAdapter('vray', 'V-Ray', ['RENDERING']),
  ifc: new MockAdapter('ifc', 'IFC / BIM Exchange', ['MODEL_EXCHANGE'])
} satisfies Record<string, ArchonEngineAdapter>;

export type EngineAdapterKey = keyof typeof engineAdapters;

export { ApsAuthService, ApsAutomationService, getApsConfig, getApsDiagnostics, createDwgPipelinePlan } from './aps';
export type { ApsConfig, DwgPipelinePlan } from './aps';
