# ARCHON v2 — SketchUp + LayOut Production System

## Decision

ARCHON is pivoting from an Autodesk-first / generic CAD automation platform into an AI production system centered on **SketchUp + LayOut**.

SketchUp is the editable geometry engine. LayOut is the construction-document engine. ARCHON remains the intelligence, governance, automation, revision, QA, and publishing layer.

The existing Autodesk/APS work is frozen as a legacy-compatible adapter path. It is not deleted and it must not block the v2 path.

## Non-negotiable governance

Every authoritative change continues to follow:

`Intent → Proposed ChangeSet → Sandbox/Preview → Validation → Checklist → Review/Edit → Approval → Immutable Version → External Sync → Reconciliation`

Rules:

1. No silent model mutation.
2. No production ChangeSet commit without explicit approval.
3. Adapter execution success is not equivalent to approval.
4. Geometry dimensions remain in native SketchUp model units; drawing scale belongs to viewports/sheets.
5. ARCHON-managed geometry and user overrides must be distinguishable.
6. Generated drawing entities must never erase user-owned manual adjustments without an explicit reviewed ChangeSet.

## v2 architecture

```text
ARCHON Cloud / Railway
  ├─ Project + version state
  ├─ Command / AI interpretation
  ├─ Proposed ChangeSets
  ├─ Validation + approval
  ├─ Model manifests
  ├─ Drawing manifests
  └─ Publish / reconciliation records
            │
            │ HTTPS authenticated bridge
            ▼
ARCHON for SketchUp (.rbz)
  ├─ Read-only model analyzer
  ├─ Entity identity / metadata
  ├─ Geometry executor (post-approval only)
  ├─ Scene + section generator
  ├─ Material / component mapper
  ├─ LayOut document generator
  ├─ Revision detector
  └─ Export / publish bridge
            │
       ┌────┴────┐
       ▼         ▼
   SketchUp    LayOut
   geometry    drawings
```

## Product navigation

The long-term v2 UI is intentionally reduced to four primary workspaces:

- **Project** — project metadata, sync health, versions, publish history.
- **Model** — semantic object inventory, levels, rooms, walls, openings, joinery, materials.
- **Drawings** — plans, elevations, sections, details, affected-sheet status.
- **Command** — natural-language intent, proposed operations, preview, validation, approval.

## Phase 0 — Freeze legacy safely

- Keep existing Autodesk/APS code intact.
- Mark it `legacy-compatible` in architecture documentation.
- Do not remove endpoints, worker processes, validation receipts, evidence stores, or prior audit trails.
- New v2 feature work should target SketchUp/LayOut unless explicitly scoped otherwise.

**Done when:** mainline can still build and legacy endpoints remain callable, while v2 work is isolated behind its own integration namespace.

## Phase 1 — ARCHON for SketchUp extension

Create `sketchup-extension/` with an installable Ruby extension.

Initial toolbar/dialog actions:

- Connection status
- Analyze Current Model
- Send Manifest
- Generate Drawings (disabled until later phase)
- Update Drawings (disabled until later phase)
- Publish (disabled until later phase)

The first implementation is strictly read-only with respect to model geometry.

**Done when:** the extension loads in SketchUp, opens its ARCHON dialog, and can build a deterministic local model manifest.

## Phase 2 — Authenticated cloud bridge

Add a dedicated integration namespace:

`POST /api/integrations/sketchup/manifest`

Initial bridge rules:

- HTTPS only in production.
- Bearer token supplied by the SketchUp extension.
- Server token is configured through `ARCHON_SKETCHUP_BRIDGE_TOKEN`.
- Payload-size guard.
- Schema/version field required.
- Read-only receipt response in the first slice.
- Never execute a ChangeSet merely because a manifest was accepted.

**Done when:** a SketchUp client can submit a manifest and receive a receipt without changing project/model state.

## Phase 3 — Existing SKP → semantic manifest

The analyzer captures:

### Model metadata

- model GUID
- model title/path (path may be omitted/redacted later for privacy)
- SketchUp version/platform
- modified state
- model bounds

### Collections

- root entity counts
- groups
- component instances
- component definitions
- materials
- tags/layers
- scenes/pages
- section planes

### Entity identity

Where supported:

- `persistent_id`
- entity type
- name
- tag/layer
- visibility
- locked status
- bounding box
- ARCHON attribute dictionary values

No geometry mutation occurs during analysis.

**Done when:** running analysis twice on an unchanged model produces semantically equivalent manifests and stable persistent IDs.

## Phase 4 — Model classification + Building Graph v2

Simplify the canonical graph around production objects:

```text
Project
 ├─ Levels
 ├─ Rooms
 ├─ Walls
 ├─ Openings
 │   ├─ Doors
 │   └─ Windows
 ├─ Floors
 ├─ Ceilings
 ├─ Columns
 ├─ Furniture
 ├─ Joinery
 ├─ Lighting
 ├─ Materials
 └─ DrawingViews
```

Every managed object receives an ARCHON ID stored in both ARCHON and the SketchUp entity attribute dictionary.

Classification is reviewable before any metadata is written back to the model.

## Phase 5 — Scene + section generation

Generate deterministic views:

- floor plan
- furniture plan
- floor-finish plan
- reflected ceiling plan
- room elevations
- building sections

Scene generation must control camera, projection, tag visibility, style, active section plane, and view identity.

## Phase 6 — LayOut document engine

Use a Markstudios master `.layout` template.

Generate:

- title blocks
- sheet IDs
- sheet titles
- model viewports
- scales
- view labels
- references

No auto-dimensioning is considered complete until model-reference behavior survives revision tests.

## Phase 7 — Dimensions + annotations

Dimension hierarchy:

1. openings
2. wall segments / joinery subdivisions
3. principal geometry / grids
4. overall dimensions

Annotations:

- room tags
- floor/ceiling levels
- door/window tags
- material / finish codes
- joinery codes
- section/detail references

## Phase 8 — Revision propagation

Detect changes by stable entity identity and semantic object ID.

Example:

```text
JN-004 Reception Counter
width: 3600 → 4200
Affected views: PLAN_GF, ELEV_RCP_A, ELEV_RCP_C, JN_DETAIL_004
Affected sheets: A-101, A-205, A-207, J-404
```

Update flow:

`Detect → Proposed Update ChangeSet → affected drawings → preview → validate → approve → update → reconcile`

## Phase 9 — Publisher

One governed publish action produces a revision folder containing:

- `.skp`
- `.layout`
- combined PDF
- DWG sheets / exports
- manifest + checksums
- revision metadata

## Phase 10 — Floorplan → white model

Only after existing-SKP analysis and drawing generation are reliable:

`DWG/PDF/image plan → plan interpretation → review/correction → approved geometry ChangeSet → SketchUp white model`

Do not let raster-plan inference silently determine authoritative dimensions. Uncertain dimensions remain review items.

## Phase 11 — Reference image → design

Reference images may propose:

- materials
- ceiling concepts
- lighting families
- furniture
- joinery
- styling

Reference-derived dimensions are non-authoritative unless explicitly approved.

## First implementation slice (current branch)

This branch should deliver only:

1. v2 architecture declaration;
2. installable SketchUp extension scaffold;
3. read-only model-manifest generator;
4. authenticated manifest endpoint;
5. connection/analyze/send UI;
6. tests/build verification for the web app;
7. no production merge or deploy until review/approval.

## Acceptance test for the slice

1. Install ARCHON extension in SketchUp.
2. Open a real `.skp` file.
3. Open ARCHON panel.
4. Configure ARCHON URL and bridge token locally.
5. Click **Analyze Current Model**.
6. Confirm counts, model GUID, scenes, tags, materials, and entity summary appear.
7. Click **Send Manifest**.
8. Railway API returns a receipt ID and hash.
9. Repeat without model changes: manifest semantic content remains equivalent.
10. Confirm SketchUp geometry and LayOut documents were not mutated.
