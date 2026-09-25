# ARCHON for SketchUp

ARCHON SketchUp bridge **v0.3.4 candidate**. Persistent geometry mutation remains locked. This slice adds a governed rollback rehearsal that can materialize temporary native 2D SketchUp geometry inside a model transaction, then **must abort the transaction** and verify that the root entity count returns to its exact pre-rehearsal value.

## Current capabilities

- ARCHON panel inside SketchUp;
- local connection configuration for base URL, bridge token, and optional project ID;
- read-only active-model analysis and semantic manifest upload;
- deterministic Building Graph v2 preview;
- Prompt → Basic Layout preview;
- immutable execution-package approval in ARCHON cloud;
- authenticated retrieval of an approved package as a deterministic **SketchUp Executor Dry-Run Plan**;
- authenticated retrieval of the same approved package as a deterministic **SketchUp Rollback Rehearsal Plan**;
- local verification of operation IDs, room references, door host-wall references, model identity, and operation counts;
- dry-run report with `mutation: none` and `modelTransactionOpened: false`;
- abort-only rehearsal for `CREATE_ROOM`, `CREATE_WALL`, `CREATE_DOOR`, and `CREATE_LABEL` using temporary native SketchUp edges, groups, and text;
- post-abort verification that root entity count is unchanged.

## Executor candidate safety boundary

```text
Execution Package APPROVED_LOCKED
        ↓
Server Executor Dry-Run Plan
        ↓
Local SketchUp Dry-Run Validation
        ↓
DRY_RUN_VERIFIED
        ↓
Server Rollback Rehearsal Plan
        ↓
Temporary Native 2D Geometry
inside SketchUp transaction
        ↓
MANDATORY abort_operation
        ↓
Root entity count verification
        ↓
ROLLBACK_VERIFIED
        ↓
STOP
        ↓
APPROVE_SKETCHUP_EXECUTOR  ← separate future gate
```

The rollback rehearsal is intentionally **not** a persistent executor. CI fails if `commit_operation`, model save, destructive erase, transforms, push/pull, or other persistent execution paths appear in the candidate before the future executor gate is approved.

`Archon::Executor.execute!` still always raises `ARCHON_EXECUTOR_GATE_LOCKED`.

## Dry-run smoke test

Prerequisite: an execution package must already exist in ARCHON with durable database state `APPROVED_LOCKED` and its package SHA-256 must be available to the operator.

1. Install the v0.3.4 candidate RBZ.
2. Open a real `.skp` file or a blank SketchUp model.
3. Configure the existing ARCHON connection.
4. Choose **Extensions → ARCHON Executor Dry-Run**.
5. Paste the 64-character approved package SHA-256.
6. ARCHON cloud validates the package ledger and approval record.
7. SketchUp locally validates the returned executor plan.
8. Confirm the result shows room, wall, door, label, and total operation counts.
9. Confirm the dialog states that no SketchUp transaction was opened and geometry mutation remains locked.
10. Confirm the Ruby Console report contains:
   - `state: DRY_RUN_VERIFIED`
   - `mutation: none`
   - `modelTransactionOpened: false`
   - `geometryMutationAttempted: false`
   - `executionEnabled: false`
   - `requiredNextGate: APPROVE_SKETCHUP_EXECUTOR`
11. Confirm the model entity count and visible geometry are unchanged.

## Rollback rehearsal smoke test

Run this only after the dry-run above succeeds for the same approved package.

1. Save a copy of the `.skp` used for testing even though the rehearsal is designed to leave no persistent changes.
2. Choose **Extensions → ARCHON Rollback Rehearsal**.
3. Paste the same 64-character approved package SHA-256.
4. ARCHON cloud returns `archon.sketchup-executor-rehearsal-plan.v1` with `commitAllowed: false`, `abortRequired: true`, and `persistentGeometryAllowed: false`.
5. SketchUp opens one operation named `ARCHON Rollback Rehearsal`.
6. ARCHON creates a temporary root group named `__ARCHON_ROLLBACK_REHEARSAL__` and materializes governed 2D operations inside it.
7. The executor always calls `abort_operation` from an `ensure` block.
8. Confirm the completion dialog reports `ROLLBACK_VERIFIED` and states that no geometry was persisted.
9. Confirm Ruby Console output contains:
   - `mutation: transient_rollback_only`
   - `modelTransactionOpened: true`
   - `geometryMutationAttempted: true`
   - `transactionCommitted: false`
   - `transactionAborted: true`
   - `persistentGeometryChanged: false`
   - identical `rootEntityCountBefore` and `rootEntityCountAfter`
   - `requiredNextGate: APPROVE_SKETCHUP_EXECUTOR`
10. Confirm Undo history and visible model contain no persistent ARCHON rehearsal geometry after completion.

If root entity count differs after abort, the rehearsal raises `ARCHON_EXECUTOR_ROLLBACK_VERIFY_FAILED` and must be treated as a blocker.

## Existing-model semantic smoke test

1. Open a real `.skp` file.
2. Open **Extensions → ARCHON**.
3. Click **Analyze Current Model**.
4. Confirm Root, Semantic, Faces, and Materials counts.
5. Analyze again without modifying the model and confirm the semantic hash is unchanged.
6. Click **Send Manifest**.
7. Confirm `accepted: true`, `mutation: none`, and `buildingGraph.schema: archon.building-graph.v2`.
8. Confirm model geometry has not changed.

## Security

The bridge sends the raw bearer token only from the local SketchUp client. Server authentication for the SketchUp integration routes reads `ARCHON_SKETCHUP_BRIDGE_TOKEN_SHA256` and compares a hash of the incoming bearer token. A legacy Railway variable named `ARCHON_SKETCHUP_BRIDGE_TOKEN` is still present in the production variable inventory and should be removed in a separately approved credential-hardening change after confirming no older client depends on it.

Before broad distribution, move to per-device credentials with revocation/rotation and bind each device to user/project authorization scope.

## Still locked

- persistent native SketchUp create/edit geometry;
- `commit_operation` from ARCHON executor;
- `Approve & Draw`;
- writing persistent ARCHON IDs back to model entities;
- automatic 3D extrusion;
- scene/section generation;
- LayOut sheet generation;
- external publishing/sync.
