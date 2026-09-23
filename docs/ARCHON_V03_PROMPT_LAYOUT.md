# ARCHON v0.3 — Prompt → Basic Layout

## Objective

Start from a blank SketchUp model and turn a natural-language spatial brief into reviewable 2D layout candidates before any SketchUp geometry is created.

This slice is intentionally preview-only.

## User flow

```text
Blank SketchUp
  ↓
ARCHON prompt
  ↓
Space Program
  ↓
Constraint normalization
  ↓
3 layout candidates
  ↓
Validation
  ↓
Review
  ↓
Approval locked in this slice
```

Example:

> Buat kantor 12 x 20 meter untuk 20 staff, reception, 2 meeting room, director room, open office, pantry, toilet pria dan wanita. Corridor minimum 1.2 m. Dinding 100 mm.

ARCHON must never invent an authoritative building footprint when it is missing.

## Canonical units

- geometry: millimetres
- model scale: 1:1
- area display: square metres
- drawing scale is not part of v0.3

## Space Program v1

Recognized initial room types:

- Reception
- Meeting Room
- Director Room
- Open Office
- Private Office
- Pantry
- Male Toilet
- Female Toilet
- Storage
- Kitchen
- Dining
- Private Dining
- Bar

Each parsed room contains a stable temporary room ID, semantic kind, label, target width/depth, target area, optional capacity, and provenance showing whether dimensions came explicitly from the prompt or from a reviewable default.

## Constraints

Initial deterministic checks:

- footprint required
- footprint safety range
- wall thickness safety range
- minimum corridor safety range
- room rectangles remain inside footprint
- room rectangles do not overlap
- program density warning before circulation/wall allowance

The solver does not claim code compliance or life-safety compliance in v0.3.

## Candidate solver

The first deterministic solver generates three candidate strategies:

- `OPTION_A` — horizontal shelf packing
- `OPTION_B` — vertical shelf packing
- `OPTION_C` — public-front / support-rear ordering

These are algorithmic starter candidates, not architectural quality rankings. The user decides which direction to review.

## SketchUp bridge

New endpoint:

`POST /api/integrations/sketchup/layout/preview`

Authentication uses the existing SketchUp bridge bearer credential.

Response includes:

- parsed space program
- assumptions
- unresolved requirements
- 3 candidates where possible
- room rectangles
- proposed wall segments
- placeholder door locations
- candidate metrics
- validation findings
- governance checklist

The endpoint returns:

```text
mutation: none
execution.mode: PREVIEW_ONLY
sketchUpMutationEnabled: false
approveAndDrawEnabled: false
```

## Extension v0.3.0

The SketchUp panel now exposes **Prompt → Basic Layout** above the existing-model analyzer.

It can:

- send a layout prompt
- show parsed program
- show unresolved input
- render candidate mini-plan previews
- show candidate validity/findings

It cannot yet:

- choose/commit an authoritative candidate
- create native SketchUp geometry
- update an existing approved plan
- generate 3D
- send to LayOut

## Next slice after approval

`v0.3.1 — Candidate Review + Proposed Draw ChangeSet`

Add:

1. candidate selection;
2. editable room program;
3. explicit review checklist;
4. convert selected candidate into a Proposed ChangeSet;
5. show exact SketchUp operations before mutation;
6. still require explicit approval before drawing.

Only after that slice is verified should we implement `Approve & Draw` and native SketchUp 2D geometry creation.
