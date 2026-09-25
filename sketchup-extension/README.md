# ARCHON for SketchUp

ARCHON SketchUp bridge **v0.3.3 candidate**. Geometry mutation remains locked. This slice can inspect an immutable approved execution package and build a local dry-run report, but it cannot open a SketchUp transaction or draw geometry.

## Current capabilities

- ARCHON panel inside SketchUp;
- local connection configuration for base URL, bridge token, and optional project ID;
- read-only active-model analysis and semantic manifest upload;
- deterministic Building Graph v2 preview;
- Prompt → Basic Layout preview;
- immutable execution-package approval in ARCHON cloud;
- authenticated retrieval of an approved package as a deterministic **SketchUp Executor Dry-Run Plan**;
- local verification of operation IDs, room references, door host-wall references, model identity, and operation counts;
- dry-run report with `mutation: none` and `modelTransactionOpened: false`.

## Executor candidate safety boundary

v0.3.3 introduces `archon/executor.rb`, but the execution method is deliberately hard locked:

```text
Execution Package APPROVED_LOCKED
        ↓
Server Executor Plan
        ↓
Local SketchUp Dry-Run Validation
        ↓
DRY_RUN_VERIFIED
        ↓
STOP
        ↓
APPROVE_SKETCHUP_EXECUTOR  ← separate future gate
```

The candidate contains no calls to SketchUp geometry mutation APIs. CI rejects the executor candidate if mutation methods such as transaction start/commit, face/line/group creation, entity erase, or transforms are introduced before the gate is approved.

`Archon::Executor.execute!` always raises `ARCHON_EXECUTOR_GATE_LOCKED` in this slice.

## Dry-run smoke test

Prerequisite: an execution package must already exist in ARCHON with durable database state `APPROVED_LOCKED` and its package SHA-256 must be available to the operator.

1. Install the v0.3.3 candidate RBZ.
2. Open a real `.skp` file.
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

The bridge sends the raw bearer token only from the local SketchUp client. Railway stores only `ARCHON_SKETCHUP_BRIDGE_TOKEN_SHA256`. Execution-package dry-run uses the same authenticated bridge boundary and never returns or logs the raw token.

Before broad distribution, move to per-device credentials with revocation/rotation and bind each device to user/project authorization scope.

## Still locked

- native SketchUp create/edit geometry;
- model transactions;
- `Approve & Draw`;
- writing ARCHON IDs back to entities;
- automatic 3D extrusion;
- scene/section generation;
- LayOut sheet generation;
- external publishing/sync.
