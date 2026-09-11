import type { ChangeSetState, ValidationFinding } from './index';

const transitions: Record<ChangeSetState, readonly ChangeSetState[]> = {
  DRAFT: ['PROPOSED'],
  PROPOSED: ['SANDBOXED','REJECTED'],
  SANDBOXED: ['VALIDATING','REJECTED'],
  VALIDATING: ['NEEDS_REVIEW','VALIDATION_FAILED'],
  NEEDS_REVIEW: ['APPROVED','REJECTED','VALIDATING'],
  APPROVED: ['COMMITTING'],
  REJECTED: [],
  COMMITTING: ['COMMITTED'],
  COMMITTED: [],
  VALIDATION_FAILED: ['PROPOSED','REJECTED']
};

export function canTransition(from: ChangeSetState, to: ChangeSetState): boolean {
  return transitions[from].includes(to);
}

export function transitionChangeSet(from: ChangeSetState, to: ChangeSetState): ChangeSetState {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal ChangeSet transition: ${from} -> ${to}`);
  }
  return to;
}

export function hasBlockingFindings(findings: readonly ValidationFinding[]): boolean {
  return findings.some(f => f.status === 'BLOCKER' || f.status === 'CRITICAL');
}

export function canApprove(state: ChangeSetState, findings: readonly ValidationFinding[]): boolean {
  return state === 'NEEDS_REVIEW' && !hasBlockingFindings(findings);
}
