import type { DrawingIROperation } from './drawing-ir.ts';

export type SketchUpExecutorPlanFinding = {
  code: string;
  severity: 'PASS' | 'BLOCKER';
  message: string;
  operationId?: string;
};

export type SketchUpExecutorDryRunPlan = {
  schema: 'archon.sketchup-executor-plan.v1';
  state: 'DRY_RUN_READY';
  targetEngine: 'SKETCHUP';
  executionMode: 'NATIVE_2D_DRY_RUN';
  units: 'mm';
  source: {
    packageHash: string;
    approvalReference: string;
    proposedChangeSetId: string;
    drawingIrFingerprint: string;
    packageDraftFingerprint: string;
  };
  operations: DrawingIROperation[];
  operationCount: number;
  summary: {
    createRoom: number;
    createWall: number;
    createDoor: number;
    createLabel: number;
  };
  validation: SketchUpExecutorPlanFinding[];
  deterministicFingerprint: string;
  safety: {
    mutation: 'none';
    dryRunOnly: true;
    sketchUpMutationEnabled: false;
    rubyExecutorCalled: false;
    transactionOpened: false;
    geometryMutationAllowed: false;
    requiredNextGate: 'APPROVE_SKETCHUP_EXECUTOR';
  };
};

const SHA256_HEX = /^[a-f0-9]{64}$/i;
const FINGERPRINT = /^[a-f0-9]{8,64}$/i;

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function fingerprint(value: unknown) {
  const input = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function text(value: unknown, code: string, max = 240) {
  if (typeof value !== 'string') throw new Error(code);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error(code);
  return normalized;
}

function finite(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value);
}

function point3(value: unknown) {
  return Array.isArray(value) && value.length === 3 && value.every(finite);
}

function validateOperationShape(operation: unknown): operation is DrawingIROperation {
  if (!operation || typeof operation !== 'object') return false;
  const item = operation as Record<string, unknown>;
  if (typeof item.op !== 'string' || typeof item.id !== 'string' || !item.id.trim()) return false;

  if (item.op === 'CREATE_ROOM') {
    return typeof item.roomId === 'string'
      && typeof item.label === 'string'
      && typeof item.kind === 'string'
      && point3(item.originMm)
      && finite(item.widthMm) && Number(item.widthMm) > 0
      && finite(item.depthMm) && Number(item.depthMm) > 0;
  }
  if (item.op === 'CREATE_WALL') {
    return point3(item.startMm)
      && point3(item.endMm)
      && finite(item.thicknessMm) && Number(item.thicknessMm) > 0
      && (item.role === 'PERIMETER' || item.role === 'PARTITION');
  }
  if (item.op === 'CREATE_DOOR') {
    return typeof item.roomId === 'string'
      && typeof item.hostWallId === 'string'
      && finite(item.widthMm) && Number(item.widthMm) > 0
      && point3(item.positionMm)
      && (item.orientation === 'HORIZONTAL' || item.orientation === 'VERTICAL');
  }
  if (item.op === 'CREATE_LABEL') {
    return typeof item.roomId === 'string'
      && typeof item.text === 'string'
      && point3(item.positionMm);
  }
  return false;
}

export function createSketchUpExecutorDryRunPlan(input: {
  packageHash: string;
  packageState: string;
  executionEnabled: boolean;
  approvalReference: string;
  approvalDecision: string;
  payload: unknown;
}): SketchUpExecutorDryRunPlan {
  const packageHash = input.packageHash.trim().toLowerCase();
  if (!SHA256_HEX.test(packageHash)) throw new Error('SKETCHUP_EXECUTOR_PACKAGE_HASH_INVALID');
  if (input.packageState !== 'APPROVED_LOCKED') throw new Error('SKETCHUP_EXECUTOR_PACKAGE_NOT_LOCKED');
  if (input.executionEnabled) throw new Error('SKETCHUP_EXECUTOR_PACKAGE_EXECUTION_ALREADY_ENABLED');
  const approvalReference = text(input.approvalReference, 'SKETCHUP_EXECUTOR_APPROVAL_REFERENCE_INVALID');
  if (input.approvalDecision !== 'APPROVE_EXECUTION_PACKAGE') {
    throw new Error('SKETCHUP_EXECUTOR_PACKAGE_NOT_APPROVED');
  }
  if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) {
    throw new Error('SKETCHUP_EXECUTOR_PACKAGE_PAYLOAD_INVALID');
  }

  const payload = input.payload as Record<string, unknown>;
  if (payload.schema !== 'archon.sketchup-execution-package.v1') throw new Error('SKETCHUP_EXECUTOR_PACKAGE_SCHEMA_INVALID');
  if (payload.state !== 'APPROVAL_READY') throw new Error('SKETCHUP_EXECUTOR_PACKAGE_PAYLOAD_STATE_INVALID');
  if (payload.targetEngine !== 'SKETCHUP' || payload.executionMode !== 'NATIVE_2D_LAYOUT' || payload.units !== 'mm') {
    throw new Error('SKETCHUP_EXECUTOR_PACKAGE_TARGET_INVALID');
  }

  const source = payload.source as Record<string, unknown> | undefined;
  const safety = payload.safety as Record<string, unknown> | undefined;
  if (!source || !safety) throw new Error('SKETCHUP_EXECUTOR_PACKAGE_BINDING_INVALID');
  const proposedChangeSetId = text(source.proposedChangeSetId, 'SKETCHUP_EXECUTOR_CHANGESET_ID_INVALID');
  const drawingIrFingerprint = text(source.drawingIrFingerprint, 'SKETCHUP_EXECUTOR_DRAWING_FINGERPRINT_INVALID');
  const packageDraftFingerprint = text(payload.draftFingerprint, 'SKETCHUP_EXECUTOR_DRAFT_FINGERPRINT_INVALID');
  if (!FINGERPRINT.test(drawingIrFingerprint) || !FINGERPRINT.test(packageDraftFingerprint)) {
    throw new Error('SKETCHUP_EXECUTOR_FINGERPRINT_INVALID');
  }
  if (safety.geometryMutationAllowed !== false
    || safety.executionEnabled !== false
    || safety.rubyExecutorAllowed !== false
    || safety.requiredNextGate !== 'APPROVE_SKETCHUP_EXECUTOR') {
    throw new Error('SKETCHUP_EXECUTOR_SOURCE_SAFETY_CONTRACT_INVALID');
  }

  const rawOperations = payload.operations;
  if (!Array.isArray(rawOperations) || !rawOperations.every(validateOperationShape)) {
    throw new Error('SKETCHUP_EXECUTOR_OPERATION_INVALID');
  }
  const operations = rawOperations as DrawingIROperation[];
  if (payload.operationCount !== operations.length) throw new Error('SKETCHUP_EXECUTOR_OPERATION_COUNT_MISMATCH');
  if (!operations.length) throw new Error('SKETCHUP_EXECUTOR_OPERATIONS_EMPTY');

  const findings: SketchUpExecutorPlanFinding[] = [];
  const ids = operations.map(operation => operation.id);
  findings.push(new Set(ids).size === ids.length
    ? { code: 'OPERATION_IDS_UNIQUE', severity: 'PASS', message: 'All Drawing IR operation IDs are unique.' }
    : { code: 'OPERATION_ID_DUPLICATE', severity: 'BLOCKER', message: 'Duplicate Drawing IR operation IDs detected.' });

  const wallIds = new Set(operations.filter(operation => operation.op === 'CREATE_WALL').map(operation => operation.id));
  const roomIds = new Set(operations.filter(operation => operation.op === 'CREATE_ROOM').map(operation => operation.roomId));
  const doorsWithoutWall = operations.filter(operation => operation.op === 'CREATE_DOOR' && !wallIds.has(operation.hostWallId));
  findings.push(doorsWithoutWall.length
    ? { code: 'DOOR_HOST_WALL_UNRESOLVED', severity: 'BLOCKER', message: `${doorsWithoutWall.length} door operation(s) reference a missing wall.` }
    : { code: 'DOOR_HOST_WALLS_RESOLVED', severity: 'PASS', message: 'All door operations resolve to a proposed wall.' });

  const roomReferencesMissing = operations.filter(operation =>
    (operation.op === 'CREATE_DOOR' || operation.op === 'CREATE_LABEL') && !roomIds.has(operation.roomId));
  findings.push(roomReferencesMissing.length
    ? { code: 'ROOM_REFERENCE_UNRESOLVED', severity: 'BLOCKER', message: `${roomReferencesMissing.length} operation(s) reference a missing room.` }
    : { code: 'ROOM_REFERENCES_RESOLVED', severity: 'PASS', message: 'All door and label room references resolve.' });

  if (findings.some(finding => finding.severity === 'BLOCKER')) {
    throw new Error(`SKETCHUP_EXECUTOR_PLAN_BLOCKED:${findings.filter(finding => finding.severity === 'BLOCKER').map(finding => finding.code).join(',')}`);
  }

  const summary = {
    createRoom: operations.filter(operation => operation.op === 'CREATE_ROOM').length,
    createWall: operations.filter(operation => operation.op === 'CREATE_WALL').length,
    createDoor: operations.filter(operation => operation.op === 'CREATE_DOOR').length,
    createLabel: operations.filter(operation => operation.op === 'CREATE_LABEL').length
  };
  const base = {
    schema: 'archon.sketchup-executor-plan.v1' as const,
    state: 'DRY_RUN_READY' as const,
    targetEngine: 'SKETCHUP' as const,
    executionMode: 'NATIVE_2D_DRY_RUN' as const,
    units: 'mm' as const,
    source: {
      packageHash,
      approvalReference,
      proposedChangeSetId,
      drawingIrFingerprint,
      packageDraftFingerprint
    },
    operations,
    operationCount: operations.length,
    summary,
    validation: findings,
    safety: {
      mutation: 'none' as const,
      dryRunOnly: true as const,
      sketchUpMutationEnabled: false as const,
      rubyExecutorCalled: false as const,
      transactionOpened: false as const,
      geometryMutationAllowed: false as const,
      requiredNextGate: 'APPROVE_SKETCHUP_EXECUTOR' as const
    }
  };

  return {
    ...base,
    deterministicFingerprint: fingerprint(base)
  };
}
