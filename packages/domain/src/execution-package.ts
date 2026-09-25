import type {
  DrawingIRFinding,
  DrawingIROperation,
  LayoutReviewProposal
} from './drawing-ir.ts';

export type SketchUpExecutionPackageDraft = {
  schema: 'archon.sketchup-execution-package.v1';
  state: 'APPROVAL_READY';
  targetEngine: 'SKETCHUP';
  executionMode: 'NATIVE_2D_LAYOUT';
  units: 'mm';
  projectRef: string | null;
  source: {
    sourcePrompt: string;
    selectedCandidateId: string;
    proposedChangeSetId: string;
    drawingIrFingerprint: string;
    reviewFingerprint: string;
  };
  reviewEvidence: Array<Pick<DrawingIRFinding, 'code' | 'severity' | 'message'>>;
  operations: DrawingIROperation[];
  operationCount: number;
  draftFingerprint: string;
  safety: {
    packagingApprovalOnly: true;
    geometryMutationAllowed: false;
    executionEnabled: false;
    rubyExecutorAllowed: false;
    approvedBuildingStateMutated: false;
    requiredNextGate: 'APPROVE_SKETCHUP_EXECUTOR';
  };
};

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

function fnv1aFingerprint(value: unknown) {
  const input = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function canonicalizeExecutionPackage(value: unknown) {
  return stableStringify(value);
}

export function createSketchUpExecutionPackageDraft(input: {
  review: LayoutReviewProposal;
  projectRef?: string | null;
}): SketchUpExecutionPackageDraft {
  const { review } = input;
  if (review.state !== 'REVIEW_READY') throw new Error('EXECUTION_PACKAGE_REVIEW_NOT_READY');
  if (review.mutation !== 'none') throw new Error('EXECUTION_PACKAGE_REVIEW_MUTATION_INVALID');
  if (review.validation.some(finding => finding.severity === 'BLOCKER')) {
    throw new Error('EXECUTION_PACKAGE_VALIDATION_BLOCKED');
  }
  if (review.proposedChangeSet.state !== 'PROPOSED') {
    throw new Error('EXECUTION_PACKAGE_CHANGESET_NOT_PROPOSED');
  }
  if (review.proposedChangeSet.approvalGranted || review.proposedChangeSet.executable) {
    throw new Error('EXECUTION_PACKAGE_SOURCE_ALREADY_EXECUTABLE');
  }
  if (review.drawingIR.mutation !== 'none') throw new Error('EXECUTION_PACKAGE_DRAWING_IR_MUTATION_INVALID');
  if (review.drawingIR.operationCount !== review.drawingIR.operations.length) {
    throw new Error('EXECUTION_PACKAGE_OPERATION_COUNT_MISMATCH');
  }

  const projectRef = typeof input.projectRef === 'string' && input.projectRef.trim()
    ? input.projectRef.trim()
    : null;
  if (projectRef && projectRef.length > 160) throw new Error('EXECUTION_PACKAGE_PROJECT_REF_TOO_LONG');

  const reviewFingerprint = fnv1aFingerprint({
    sourcePrompt: review.sourcePrompt,
    selectedCandidateId: review.selectedCandidateId,
    editsApplied: review.editsApplied,
    validation: review.validation,
    proposedChangeSetId: review.proposedChangeSet.id,
    drawingIrFingerprint: review.drawingIR.deterministicFingerprint
  });

  const base = {
    schema: 'archon.sketchup-execution-package.v1' as const,
    state: 'APPROVAL_READY' as const,
    targetEngine: 'SKETCHUP' as const,
    executionMode: 'NATIVE_2D_LAYOUT' as const,
    units: 'mm' as const,
    projectRef,
    source: {
      sourcePrompt: review.sourcePrompt,
      selectedCandidateId: review.selectedCandidateId,
      proposedChangeSetId: review.proposedChangeSet.id,
      drawingIrFingerprint: review.drawingIR.deterministicFingerprint,
      reviewFingerprint
    },
    reviewEvidence: review.validation.map(finding => ({
      code: finding.code,
      severity: finding.severity,
      message: finding.message
    })),
    operations: review.drawingIR.operations,
    operationCount: review.drawingIR.operationCount,
    safety: {
      packagingApprovalOnly: true as const,
      geometryMutationAllowed: false as const,
      executionEnabled: false as const,
      rubyExecutorAllowed: false as const,
      approvedBuildingStateMutated: false as const,
      requiredNextGate: 'APPROVE_SKETCHUP_EXECUTOR' as const
    }
  };

  return {
    ...base,
    draftFingerprint: fnv1aFingerprint(base)
  };
}
