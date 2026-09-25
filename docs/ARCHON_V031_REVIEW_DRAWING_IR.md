# ARCHON v0.3.1 · Candidate Review + Drawing IR

## Goal

Turn a selected v0.3 layout candidate into a deterministic, auditable drawing proposal without mutating SketchUp.

The v0.3.1 path is:

```text
Prompt
→ Space Program
→ Layout Candidates A/B/C
→ Explicit Candidate Selection
→ Review/Edit room rectangles
→ Validation
→ SketchUp Drawing IR
→ Proposed Draw ChangeSet
→ Approval LOCKED
→ SketchUp Mutation LOCKED
```

## Drawing IR

Schema: `archon.sketchup-drawing-ir.v1`

Canonical units are millimetres. Coordinate system is `SKETCHUP_XY_Z_UP`.

Supported operations in this slice:

- `CREATE_ROOM`
- `CREATE_WALL`
- `CREATE_DOOR`
- `CREATE_LABEL`

The IR is intentionally adapter-neutral. It describes what a future SketchUp executor should draw, rather than embedding Ruby commands in the cloud domain model.

Every equivalent prompt + candidate + review edit set yields the same deterministic fingerprint.

## Review edits

An operator can propose changes to a candidate room rectangle using:

- `xMm`
- `yMm`
- `widthMm`
- `depthMm`

After any edit, walls and placeholder doors are regenerated from the reviewed room geometry and the full proposal is revalidated.

## Validation gates

The review path blocks if any of these conditions occur:

- missing footprint
- room dimension below the MVP minimum
- room outside footprint
- room overlap
- duplicate wall ID
- door that cannot resolve to a host wall

A blocked review returns `REVIEW_BLOCKED` and a Proposed Draw ChangeSet with `state: BLOCKED`.

## Proposed Draw ChangeSet

Schema: `archon.sketchup-draw-changeset-proposal.v1`

Even a valid proposal has:

```text
approvalGranted: false
executable: false
mutation: none
```

The `Approve & Draw` capability is not implemented in v0.3.1.

## Browser Layout Sandbox

Route: `/layout-sandbox`

The browser sandbox executes the deterministic domain solver locally and allows:

1. entering a natural-language layout prompt,
2. generating Option A/B/C,
3. selecting a candidate,
4. reviewing/editing room X/Y/W/D values in millimetres,
5. generating a Proposed Draw ChangeSet,
6. inspecting validation, operation count, deterministic fingerprint, and ChangeSet ID.

The browser sandbox cannot call SketchUp and cannot mutate geometry.

## API

`POST /api/integrations/sketchup/layout/review`

Authenticated using the existing SketchUp bridge bearer-token digest model.

Input:

```json
{
  "prompt": "Buat office 18 x 24 meter...",
  "candidateId": "OPTION_A",
  "edits": [
    { "roomId": "ROOM-001", "widthMm": 3600, "depthMm": 4000 }
  ],
  "projectId": "optional"
}
```

The response explicitly includes:

```json
{
  "mutation": "none",
  "execution": {
    "mode": "PROPOSED_CHANGESET_PREVIEW_ONLY",
    "sketchUpMutationEnabled": false,
    "approveAndDrawEnabled": false,
    "rubyExecutorCalled": false
  }
}
```

## Synthetic tests

The v0.3.1 CI includes medium office, large office, restaurant, invalid-room-edit, overlap, outside-footprint, and over-constrained scenarios.

## Next gated slice

Only after v0.3.1 review output has been tested should ARCHON implement:

```text
Reviewed Proposed Draw ChangeSet
→ explicit user approval
→ signed execution capability
→ local SketchUp Ruby executor
→ transaction / undo boundary
→ execution receipt
→ reconciliation
```

No executor may infer approval from candidate validity, API success, CI success, or adapter connectivity.
