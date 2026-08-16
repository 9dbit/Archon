import type { ChangeSetState } from "./types";

/**
 * Pure ChangeSet state machine (docs/02, docs/05 §4).
 * COMMITTED and REJECTED are terminal.
 */
const TRANSITIONS: Record<ChangeSetState, readonly ChangeSetState[]> = {
  DRAFT: ["PROPOSED"],
  PROPOSED: ["SANDBOXED", "REJECTED"],
  SANDBOXED: ["VALIDATING", "REJECTED"],
  VALIDATING: ["NEEDS_REVIEW", "VALIDATION_FAILED"],
  NEEDS_REVIEW: ["APPROVED", "REJECTED", "PROPOSED"],
  VALIDATION_FAILED: ["PROPOSED", "REJECTED"],
  APPROVED: ["COMMITTING"],
  COMMITTING: ["COMMITTED"],
  COMMITTED: [],
  REJECTED: [],
};

export function canTransition(
  from: ChangeSetState,
  to: ChangeSetState,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export class IllegalTransitionError extends Error {
  constructor(
    public readonly from: ChangeSetState,
    public readonly to: ChangeSetState,
  ) {
    super(`Illegal ChangeSet transition ${from} -> ${to}`);
    this.name = "IllegalTransitionError";
  }
}

export function assertTransition(
  from: ChangeSetState,
  to: ChangeSetState,
): ChangeSetState {
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to);
  return to;
}

export function isTerminal(state: ChangeSetState): boolean {
  return TRANSITIONS[state].length === 0;
}

/** States in which the operations payload may still be edited. */
export function isEditable(state: ChangeSetState): boolean {
  return (
    state === "DRAFT" ||
    state === "NEEDS_REVIEW" ||
    state === "VALIDATION_FAILED"
  );
}
