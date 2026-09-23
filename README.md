# ARCHON

**AI Production System for SketchUp + LayOut**

ARCHON v2 orchestrates architectural and interior production around SketchUp as the editable 3D geometry engine and LayOut as the technical-documentation engine.

ARCHON owns intelligence, governance, automation, revision control, QA, and publishing. SketchUp owns model geometry. LayOut owns sheets, dimensions, annotations, and construction-document output.

## Core principle

The canonical architectural intent remains governed by ARCHON, while SketchUp and LayOut are authoritative execution surfaces for geometry and documentation.

Every authoritative change must follow:

`Intent → Proposed ChangeSet → Sandbox/Preview → Validation → Checklist → Review/Edit → Approval → Immutable Version → External Sync → Reconciliation`

No production geometry or drawing mutation may bypass explicit approval.

## v2 product surface

- **Project** — versions, model/drawing status, sync health, publish history.
- **Model** — semantic inventory of rooms, walls, openings, floors, ceilings, furniture, joinery, materials, and views.
- **Drawings** — plans, elevations, sections, details, sheet status, affected-drawing detection.
- **Command** — natural-language intent translated into governed ChangeSets.

## Execution architecture

- `apps/web` — ARCHON cloud UI/API on Railway.
- `sketchup-extension` — ARCHON for SketchUp `.rbz` extension and local execution bridge.
- `packages/*` — governance, schemas, validation, persistence, integrations.
- SketchUp Ruby API — model inspection and geometry operations.
- LayOut Ruby API — document, page, viewport, annotation, and export automation.

## Current implementation milestone

The first v2 slice is deliberately narrow:

1. freeze the Autodesk-first path as legacy-compatible rather than deleting it;
2. connect a SketchUp extension to ARCHON cloud;
3. analyze the active SketchUp model without mutating it;
4. generate a deterministic model manifest;
5. submit the manifest to ARCHON for review;
6. add drawing generation only after the read-only bridge is verified.

See `docs/ARCHON_V2_SKETCHUP_LAYOUT.md` for the migration and delivery plan.
