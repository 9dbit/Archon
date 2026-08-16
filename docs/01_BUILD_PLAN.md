# ARCHON Build Plan v0.1

## Objective

Build ARCHON as an AI-first architecture operating system where architectural intent is stored in a vendor-neutral canonical model and synchronized through adapters to SketchUp, Revit, AutoCAD, render engines, BOQ, documentation, and future tools.

## Non-negotiable principles

1. ARCHON Canonical Model is the source of architectural intent and project truth.
2. External software is integrated through adapters. No direct SketchUp-to-Revit-to-AutoCAD synchronization.
3. Every object receives an immutable ARCHON ID.
4. Every proposed authoritative change is represented as a ChangeSet.
5. Every ChangeSet runs in a sandbox/staging state before commit.
6. Every authoritative commit passes Validation Gate and produces an editable checklist.
7. No stage advances without explicit approval for material changes.
8. Low-confidence AI output never silently changes critical building data.
9. Every commit is recoverable to a last-known-good project version.
10. Integrations must support retry, fallback, reconciliation, and degraded operation.

---

## Phase 0 — Repository & Engineering Foundation

### Goal
Create a runnable, testable web application and stable internal contracts before connecting architecture software.

### Deliverables
- TypeScript application foundation.
- Web UI shell.
- API layer.
- PostgreSQL database schema.
- ARCHON ID standard.
- Canonical object schema v0.1.
- ChangeSet schema v0.1.
- Validation result schema.
- Approval workflow schema.
- Adapter interface contract.
- Event/audit model.
- Automated tests and CI.
- Environment/secrets documentation.

### Exit criteria
- App runs locally/Replit.
- Project can be created.
- Canonical objects can be persisted.
- Proposed ChangeSet can be created without directly mutating approved state.
- Validation checklist can be reviewed and approved.
- Commit creates a new version and full audit event.

---

## Phase 1 — Project Genesis MVP

### Goal
Start a real architecture project from natural-language input and convert it into structured project requirements.

### User flow
1. New Project.
2. User enters text prompt. Voice interface may be added behind an interface.
3. ARCHON extracts structured requirements.
4. User reviews/edit requirements.
5. ARCHON creates project constraints and initial design rules.
6. Validation checklist appears.
7. User approves Project Brief baseline.

### Initial project fields
- project name
- building type
- location
- site width/depth/area
- number of levels
- floor-to-floor heights
- target GFA
- rooms/program requirements
- setbacks
- circulation rules
- door standards
- window standards
- materials/palette references
- project-specific rules

### Exit criteria
A project brief entered as natural language becomes a structured, editable, versioned and approved ARCHON project baseline.

---

## Phase 2 — Canonical Building Model & Layout Engine

### Goal
Represent architecture as semantic objects rather than loose geometry.

### Initial object types
- Project
- Site
- Level
- Grid
- Space/Room
- Zone
- Wall
- Column
- Door
- Window
- Floor
- Ceiling
- Furniture
- Material
- Light

### Core relationships
- contains
- hosts
- adjacent_to
- connected_to
- belongs_to_level
- belongs_to_room
- uses_material
- constrained_by
- depends_on

### Layout MVP
- room program
- adjacency requirements
- boundary/site constraints
- simple rectangular room generation
- multiple alternatives
- score alternatives
- user markup/selection data model

### Exit criteria
ARCHON can generate and compare simple semantic layouts without SketchUp/Revit being the master model.

---

## Phase 3 — SketchUp Adapter Proof of Concept

### Goal
Prove natural-language/manual-edit synchronization using a real modeling tool.

### Deliverables
- SketchUp Ruby extension.
- ARCHON authentication.
- WebSocket/HTTPS connection.
- Store ARCHON IDs on SketchUp entities.
- Push approved ChangeSets to SketchUp.
- Detect selected object.
- Detect meaningful manual object edits.
- Convert manual edit into Proposed ChangeSet.
- Validation before canonical commit.

### First supported commands
- move object by exact distance
- resize approved parametric object
- set material
- replace component
- read selection

### Exit criteria
Select an object in SketchUp -> issue an ARCHON command -> preview -> validate -> approve -> SketchUp changes -> canonical model and audit history stay synchronized.

---

## Phase 4 — Revit/BIM Adapter

### Goal
Make Revit the high-fidelity BIM representation while ARCHON remains canonical intent authority.

### Deliverables
- Revit .NET add-in.
- ARCHON ID mapping to Revit elements.
- Levels/grids.
- walls/doors/windows/floors/ceilings/rooms.
- standard ARCHON Revit family library.
- parameter mapping registry.
- view/sheet/schedule generation.
- Revit Automation batch pathway.
- AEC Data Model query pathway where appropriate.

### Exit criteria
Approved changes in ARCHON can update supported Revit elements and regenerate affected BIM views without losing semantic identity.

---

## Phase 5 — Documentation Engine

### Goal
Generate construction documentation from model data and maintain dependency awareness.

### Deliverables
- drawing package templates
- plans
- reflected ceiling plans
- elevations
- sections
- enlarged plans
- schedules
- furniture/shop-drawing templates
- detail references
- material callouts
- revision tracking
- affected-sheet detection

### Exit criteria
A model change identifies affected documentation and regenerates/reviews only the required assets.

---

## Phase 6 — MEP, BOQ, Materials & Method Statements

### Goal
Connect architectural changes to engineering and construction consequences.

### Modules
- MEP semantic system
- clash/clearance validation
- material intelligence library
- BOQ quantities
- cost estimates
- installation assembly data
- method statement generator
- QC/checklist generator

### Exit criteria
A design change can report affected MEP, material quantities, cost, documentation, and construction-method implications before approval.

---

## Phase 7 — Rendering & Advanced Geometry

### Integrations
- V-Ray App SDK
- Rhino.Compute / Grasshopper
- optional additional render and geometry engines

Render outputs are derived assets. They never become architectural source-of-truth.

---

## Phase 8 — Studio Operations

### Modules
- project timeline
- milestones
- daily tasks
- preview/presentation dates
- workload
- delay risk
- cashflow impact
- project health

---

## Build discipline

For every phase:

1. Define schema/contracts.
2. Define acceptance tests.
3. Build smallest vertical slice.
4. Validate with deterministic tests.
5. Demonstrate UI flow.
6. Record architecture decision.
7. Review checklist.
8. Approve.
9. Merge.
10. Only then start the next vertical slice.

Do not build later integrations by hard-coding assumptions into the canonical core.
