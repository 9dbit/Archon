# ARCHON UI/UX Prototype v1

A dependency-free interactive prototype for evaluating ARCHON's user-facing product architecture before real CAD/BIM integrations are implemented.

## Purpose

Validate that the planned UX maps cleanly to future engine capabilities while keeping ARCHON canonical intent, validation, approval and versioning as the authority layer.

## Included views

- Overview
- Project Genesis
- Project Dashboard
- Layout Studio
- Design Canvas
- 3D Studio
- Building Model
- Technical Drawings
- Materials
- BOQ & Cost
- Validation Center
- Timeline
- Integrations

## Core UX concepts demonstrated

- persistent ARCHON command bar for text/voice intent
- Canvas as non-authoritative exploration
- Promote to Building Model boundary
- design locks
- ChangeSet-first edits
- validation with provenance
- explicit approval
- semantic Building Model
- affected drawing / MEP / BOQ awareness
- external-engine adapter status

## Engine mapping represented in the prototype

- SketchUp: interactive concept authoring
- Revit: BIM / MEP / documentation representation
- AutoCAD: DWG details, annotations and plotting
- V-Ray: rendering
- IFC: neutral exchange
- Blender: native AI 3D sandbox
- Rhino.Compute: future parametric geometry

The prototype intentionally uses mock states. External engines must never silently mutate approved ARCHON canonical state.

## Run

Open `index.html` from a simple local static web server. The prototype has no build step and no backend dependency.

Hash routes can be used for direct review, for example `#layout`, `#studio3d`, `#validation`, and `#integrations`.

## Review target

This is not production code. The next decision is whether the information architecture, navigation, workflow boundaries, validation experience and engine mapping feel correct before converting this prototype into the production React application.
