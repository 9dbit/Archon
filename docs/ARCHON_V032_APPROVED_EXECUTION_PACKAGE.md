# ARCHON v0.3.2 — Approved Execution Package

## Purpose

v0.3.2 creates the governed bridge between a reviewed 2D layout proposal and a future SketchUp native executor.

It does **not** execute SketchUp Ruby and does **not** mutate SketchUp geometry.

## Lifecycle

```text
Prompt
  -> Layout Candidates
  -> Candidate Review / Edit
  -> Validation
  -> Drawing IR
  -> Proposed Draw ChangeSet
  -> Execution Package Draft
  -> Explicit Authenticated Package Approval
  -> Immutable APPROVED_LOCKED Package
  -> STOP
```

The next gate is intentionally separate:

```text
APPROVE_SKETCHUP_EXECUTOR
```

No package approval in v0.3.2 can cross that gate.

## Package binding

An execution package binds all of the following:

- original source prompt
- selected layout candidate
- reviewed edits
- validation evidence
- Proposed Draw ChangeSet ID
- Drawing IR deterministic fingerprint
- Drawing IR operations
- operation count
- execution package draft fingerprint
- SHA-256 hash of the canonical package payload

The approval endpoint recomputes the review from the supplied prompt, candidate and edits. It then compares the recomputed Drawing IR fingerprint and Proposed ChangeSet ID with the exact values that were reviewed by the caller.

If either differs, approval fails closed.

## Durable approval endpoint

```text
POST /api/integrations/sketchup/layout/execution-package/approve
```

Authentication uses the existing SketchUp bridge bearer credential. The server stores only the configured SHA-256 credential digest.

Required approval binding includes:

- `expectedDrawingIrFingerprint`
- `expectedProposedChangeSetId`
- `approvedBy`
- `confirmation = APPROVE_EXECUTION_PACKAGE`

Approval means only:

> The exact reviewed Drawing IR has been frozen into an immutable execution package.

Approval does not mean:

- execute Ruby
- create SketchUp entities
- modify SketchUp geometry
- create a project approved Building Graph version
- publish or sync externally

## Database immutability

Migration `0008_sketchup_execution_packages.sql` creates:

- `sketchup_execution_packages`
- `sketchup_execution_package_approvals`

The package table enforces:

```text
state = APPROVED_LOCKED
execution_enabled = false
```

Both tables have database triggers that reject `UPDATE` and `DELETE`.

The only supported lifecycle in this slice is append-only creation.

## Idempotency and conflict rules

A retry of the exact same package approval is idempotent.

The following fail closed:

- same Proposed ChangeSet bound to a different package hash
- mismatched Drawing IR fingerprint
- mismatched Proposed ChangeSet ID
- conflicting approval metadata
- blocked review
- invalid package payload
- attempts to update or delete a persisted package or approval

## Browser sandbox

`/layout-sandbox` may display the execution package draft and its fingerprints.

It does not hold the SketchUp bridge credential and therefore cannot create a durable approval from the public browser surface.

The browser approval control remains disabled.

## Safety contract

Every package draft contains:

```text
packagingApprovalOnly = true
geometryMutationAllowed = false
executionEnabled = false
rubyExecutorAllowed = false
approvedBuildingStateMutated = false
requiredNextGate = APPROVE_SKETCHUP_EXECUTOR
```

## Acceptance criteria

v0.3.2 is complete when:

1. REVIEW_READY can produce a deterministic package draft.
2. REVIEW_BLOCKED cannot produce a package.
3. authenticated approval recomputes and verifies review bindings.
4. package payload receives a canonical SHA-256 hash.
5. approval and package are stored durably.
6. exact retry is idempotent.
7. package/approval mutation is rejected by PostgreSQL.
8. `execution_enabled` cannot become true in this schema.
9. no SketchUp Ruby executor is invoked.
10. all ARCHON regression CI remains green.
