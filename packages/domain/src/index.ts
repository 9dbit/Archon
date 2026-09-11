export type ArchonId = `archon_${string}`;

export type ChangeSetState =
  | 'DRAFT'
  | 'PROPOSED'
  | 'SANDBOXED'
  | 'VALIDATING'
  | 'NEEDS_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMMITTING'
  | 'COMMITTED'
  | 'VALIDATION_FAILED';

export type ValidationStatus = 'PASS' | 'WARNING' | 'BLOCKER' | 'CRITICAL';

export type DesignLock =
  | 'geometry'
  | 'structure'
  | 'layout'
  | 'openings'
  | 'furniture'
  | 'materials'
  | 'lighting'
  | 'camera'
  | 'documentation'
  | 'rules';

export interface ChangeOperation {
  id: ArchonId;
  type: 'CREATE' | 'UPDATE' | 'MOVE' | 'DELETE' | 'ASSIGN_MATERIAL';
  targetId: ArchonId;
  payload: Record<string, unknown>;
}

export interface ChangeSet {
  id: ArchonId;
  projectId: ArchonId;
  baseVersionId: ArchonId;
  intentSummary: string;
  operations: ChangeOperation[];
  requestedLocks: DesignLock[];
  affectedDomains: string[];
  state: ChangeSetState;
  createdBy: string;
}

export interface ValidationFinding {
  id: ArchonId;
  changeSetId: ArchonId;
  category: string;
  status: ValidationStatus;
  observedValue?: string | number;
  expectedValue?: string | number;
  unit?: string;
  sourceType: string;
  sourceReference: string;
  evidence?: string;
  recommendation?: string;
  confidence: number;
}

export type EngineCapability =
  | '2D_DRAFTING'
  | 'BIM_AUTHORING'
  | '3D_MODELING'
  | 'PARAMETRIC_GEOMETRY'
  | 'RENDERING'
  | 'MODEL_EXCHANGE'
  | 'DRAWING_GENERATION';

export interface EngineJob {
  id: ArchonId;
  changeSetId: ArchonId;
  capability: EngineCapability;
  inputArtifactIds: ArchonId[];
  outputFormat?: string;
}

export interface EngineJobResult {
  jobId: ArchonId;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  outputArtifactIds: ArchonId[];
  diagnostics: string[];
}

export interface ArchonEngineAdapter {
  readonly id: string;
  readonly label: string;
  readonly capabilities: EngineCapability[];
  health(): Promise<'READY' | 'DEGRADED' | 'OFFLINE'>;
  preview(job: EngineJob): Promise<EngineJobResult>;
  execute(job: EngineJob): Promise<EngineJobResult>;
  reconcile(job: EngineJob, result: EngineJobResult): Promise<EngineJobResult>;
}

export * from './change-set';
