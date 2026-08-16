# ARCHON Build Plan v0.2

## Product thesis

ARCHON is an AI-first architecture operating system that separates **creative exploration** from **authoritative building truth**.

The platform has two primary working environments:

1. **ARCHON Canvas** — free exploration for briefs, references, alternatives, layout concepts, styles, renders, concept 3D, visual markup and AI workflows.
2. **ARCHON Building Workspace** — validated semantic architecture for dimensions, rules, BIM, materials, MEP, technical drawings, BOQ, construction methods and project operations.

A concept never silently becomes construction truth. It must pass through:

```text
Explore -> Select -> Promote -> Validate -> Review/Edit -> Approve -> Commit
```

## Non-negotiable principles

1. ARCHON Canonical Building Model is the source of authoritative architectural intent and project truth.
2. ARCHON Canvas may contain experimental or non-authoritative design artifacts.
3. Promotion from Canvas to Building Model is explicit and validated.
4. External software is integrated through adapters. No direct SketchUp-to-Revit-to-AutoCAD synchronization.
5. Every authoritative object receives an immutable ARCHON ID.
6. Every proposed authoritative change is represented as a ChangeSet.
7. Every ChangeSet runs in sandbox/staging before commit.
8. Every authoritative commit passes Validation Gate and produces an editable checklist.
9. No stage advances without explicit approval for material changes.
10. Low-confidence AI output never silently changes critical building data.
11. Geometry, structure, material, camera, rules and other scopes can be explicitly locked during AI operations.
12. Every commit is recoverable to a last-known-good project version.
13. Integrations must support retry, fallback, reconciliation and degraded operation.
14. AI providers are replaceable behind an ARCHON Model Router.
15. Render pixels, concept meshes and exported drawings are derived assets, not project truth.

---

## Phase 0 — Repository & Engineering Foundation

### Goal
Create a runnable, testable application and stable internal contracts before connecting architecture software.

### Deliverables
- TypeScript application foundation
- web UI shell
- API layer
- PostgreSQL schema
- ARCHON ID standard
- Canonical Object schema v0.1
- Canvas Artifact schema v0.1
- ChangeSet schema v0.1
- Validation result schema
- Approval workflow schema
- Adapter interface contract
- AI Provider / Model Router interface
- Event/audit model
- automated tests and CI
- environment/secrets documentation

### Exit criteria
- app runs locally/Replit
- project can be created
- canonical objects can be persisted
- canvas artifacts can be persisted separately from authoritative objects
- Proposed ChangeSet does not mutate approved state
- validation checklist can be reviewed and approved
- commit creates a new version and full audit event

---

## Phase 1 — Project Genesis MVP

### Goal
Start a real project from natural-language, voice-ready or structured input and convert it into an approved project baseline.

### Flow
```text
New Project
-> conversational brief
-> structured requirements
-> edit/review
-> project rules
-> validation
-> approval
-> Project Brief Baseline
```

### Initial project fields
- project name
- building type
- location
- site width/depth/area
- number of levels
- floor-to-floor heights
- target GFA
- space program
- setbacks
- circulation rules
- door/window standards
- material palette references
- project-specific rules
- company template / Design DNA profile

### Exit criteria
A natural-language brief becomes a structured, editable, versioned and approved ARCHON project baseline.

---

## Phase 2 — ARCHON Canvas

### Goal
Create the exploration environment where architects can think visually with AI without contaminating technical truth.

### Canvas artifact types
- brief card
- reference image
- sketch
- markup
- layout alternative
- bubble diagram
- image generation result
- style study
- render
- concept 3D
- workflow node
- decision card
- comment
- approval marker

### Interaction
- text prompt
- voice-ready command interface
- selection
- circle/highlight/arrow/line markup
- sketch input
- drag/drop references
- compare alternatives
- branch alternatives
- save workflow as template

### Required concepts
- Infinite Canvas
- alternative branches
- workflow graph
- artifact lineage
- prompt/decision history
- collaboration comments
- Design Locks

### Design Locks
Every AI operation may declare locked and editable domains:

```text
Geometry    LOCKED / EDITABLE
Structure   LOCKED / EDITABLE
Layout      LOCKED / EDITABLE
Materials   LOCKED / EDITABLE
Lighting    LOCKED / EDITABLE
Camera      LOCKED / EDITABLE
Furniture   LOCKED / EDITABLE
```

### Exit criteria
Users can explore multiple design alternatives and preserve lineage without modifying the approved Building Model.

---

## Phase 3 — Canonical Building Model & Layout Engine

### Goal
Represent architecture as semantic objects instead of loose geometry.

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

### Layout engine
- room program
- adjacency requirements
- site/boundary constraints
- circulation rules
- multiple alternatives
- scoring
- markup-driven revisions
- Design DNA weighting

### Exit criteria
ARCHON can generate, compare, score and revise semantic layouts without an external authoring tool becoming master.

---

## Phase 4 — Promote to Building Model

### Goal
Create the explicit bridge between creative Canvas artifacts and authoritative architecture.

### Promotion pipeline
```text
Selected Canvas Alternative
-> semantic extraction
-> object recognition
-> parameterization
-> canonical mapping
-> rule/constraint check
-> geometry check
-> provenance check
-> proposed ChangeSet
-> review
-> approval
-> authoritative Building Model
```

### Rules
- concept image never becomes BIM automatically
- concept 3D mesh is not assumed to be buildable
- unsupported geometry may become a proxy object
- AI-inferred dimensions require confidence + review
- promotion records full source lineage

### Exit criteria
An approved Canvas alternative can be promoted into semantic architectural objects with traceable provenance.

---

## Phase 5 — SketchUp Adapter Proof of Concept

### Goal
Prove natural-language and manual-edit synchronization using a real modeling tool.

### Deliverables
- SketchUp Ruby extension
- ARCHON authentication
- WebSocket/HTTPS connection
- ARCHON IDs on supported entities
- push approved ChangeSets
- detect selection
- detect meaningful manual edits
- external edit -> Proposed ChangeSet
- Design Lock awareness where possible
- validation before canonical commit

### First supported commands
- move object exact distance
- resize parametric object
- set material
- replace component
- read selection

### Exit criteria
Select object -> command/voice intent -> preview -> validate -> approve -> SketchUp update -> reconciliation succeeds.

---

## Phase 6 — Revit/BIM Adapter

### Goal
Make Revit the high-fidelity BIM representation while ARCHON remains semantic intent authority.

### Deliverables
- Revit .NET add-in
- ARCHON ID mapping
- level/grid/wall/door/window/floor/ceiling/room support
- ARCHON Standard Family Library
- parameter mapping registry
- view/sheet/schedule generation
- Revit Automation batch pathway
- AEC Data Model query pathway
- Send to ARCHON / Review Change / Apply Approved Change UX

### Exit criteria
Approved ARCHON changes update supported Revit elements while preserving identity, provenance and validation state.

---

## Phase 7 — Documentation Engine

### Goal
Generate coordinated construction documentation from validated model data.

### Deliverables
- plans
- RCP
- elevations
- sections
- enlarged plans
- schedules
- furniture/shop drawings
- detail references
- material callouts
- revision tracking
- affected-sheet detection
- drawing issue sets

### Exit criteria
A model change identifies impacted documentation and only regenerates/rechecks dependent assets.

---

## Phase 8 — Materials, MEP, BOQ & Construction Intelligence

### Modules
- Material Intelligence Library
- manufacturer/product metadata
- custom material creation
- render material representation
- BIM material representation
- specification and installation data
- MEP semantic model
- clash/clearance validation
- BOQ quantities
- cost estimate
- construction assembly library
- method statement generator
- QC checklist generator

### Exit criteria
A proposed design change reports MEP, materials, cost, drawing and construction-method impacts before approval.

---

## Phase 9 — AI Model Router & Advanced Generation

### Goal
Keep ARCHON independent from any single AI provider.

### Capabilities
- architectural reasoning model
- realtime/voice model
- image generation model
- image editing model
- 3D generation model
- upscaler
- video/walkthrough model
- embeddings/retrieval model
- specialized optimization model

### Routing inputs
- task type
- quality target
- latency
- cost
- privacy
- provider health
- model capabilities
- project policy

### Exit criteria
User asks for an architectural outcome; ARCHON selects the appropriate provider without exposing vendor complexity.

---

## Phase 10 — Render & Advanced Geometry

### Integrations
- V-Ray App SDK
- Rhino.Compute / Grasshopper
- future render/geometry engines

### Uses
- photorealistic render
- lighting studies
- parametric facade
- organic furniture/bar forms
- roof/form generation
- optimization

Render outputs remain derived assets.

---

## Phase 11 — ARCHON Design DNA

### Goal
Turn company/project experience into reusable design intelligence.

### Learnable domains
- visual style
- spatial preferences
- material preferences
- furniture preferences
- typical dimensions
- lighting preferences
- approved details
- repeated revision patterns
- client preferences
- workflow templates

### Governance
- learning candidate is proposed, never silently promoted
- source projects are traceable
- company standard changes require approval
- private company knowledge remains scoped by tenant/project permissions

---

## Phase 12 — Knowledge & Research Engine

### Sources
- company standards
- approved project history
- regulations
- manufacturer technical data
- credible architecture/engineering sources
- curated external research

### Rules
- every authoritative rule has provenance
- external knowledge carries confidence/freshness
- contradictory sources are surfaced
- research findings require review before becoming company standard

---

## Phase 13 — Collaboration & Permissions

### Roles
- owner
- principal architect
- project architect
- interior designer
- MEP engineer
- structural engineer
- client
- contractor
- reviewer

### Permissions
- view
- comment
- propose change
- discipline approve
- final approve
- issue drawing

---

## Phase 14 — Studio Operations

### Modules
- project timeline
- milestone planning
- daily tasks
- preview/presentation dates
- workload
- delay risk
- cashflow impact
- project health
- resource recommendations

---

## Core workflow graph

```text
PROJECT GENESIS
      |
      v
ARCHON CANVAS
      |
   explore
      |
      v
SELECTED ALTERNATIVE
      |
      v
PROMOTE TO BUILDING MODEL
      |
      v
VALIDATION + APPROVAL
      |
      v
CANONICAL BUILDING MODEL
      |
      +--> SketchUp
      +--> Revit/BIM
      +--> Materials
      +--> MEP
      +--> Documentation
      +--> BOQ/Cost
      +--> Render
      |
      v
PROJECT OPERATIONS / CONSTRUCTION
```

## Build discipline

For every phase:

1. Define schema/contracts.
2. Define acceptance tests.
3. Build the smallest useful vertical slice.
4. Validate deterministic behavior.
5. Demonstrate UI flow.
6. Record architecture decision.
7. Produce validation checklist.
8. Review/edit.
9. Approve.
10. Merge.
11. Only then expand scope.

ARCHON should grow like a city with a masterplan, not like a drawer full of extension cords.
