# ARCHON Product Plan v2

## Vision

ARCHON is an AI Architecture Operating System that helps an architecture/interior studio move continuously from **brief -> exploration -> validated design -> BIM -> documentation -> construction intelligence -> studio operations**.

The product should feel like a collaborative architectural studio, not a collection of disconnected AI tools.

## Core product promise

A user should eventually be able to say:

> "Perbesar dapur 300 mm sampai grid kolom, jangan ubah struktur, pertahankan minimum service corridor 1000 mm, lalu update 3D, BIM, gambar kerja, MEP impact, material quantity dan BOQ."

ARCHON should:
1. understand the design intent;
2. identify affected semantic objects;
3. apply locks and constraints;
4. simulate the proposed change;
5. validate against traceable sources;
6. show impacts and alternatives;
7. request approval;
8. commit the approved version;
9. synchronize supported adapters and derived assets;
10. preserve audit history and rollback capability.

---

# Product surfaces

## A. ARCHON Home / Studio OS

Purpose: operational overview across projects.

Shows:
- active projects
- milestone health
- delayed work
- current design stage
- validation blockers
- pending approvals
- sync health
- project cashflow risk
- team workload
- presentations due
- daily priorities

## B. Project Genesis

Purpose: convert a conversational brief into project truth.

Inputs:
- text
- voice
- structured fields
- uploaded references
- site files in later phases

Outputs:
- structured brief
- project rules
- program requirements
- initial company template selection
- baseline approval

## C. ARCHON Canvas

Purpose: creative exploration.

Capabilities:
- infinite canvas
- node/workflow graph
- references
- layout alternatives
- sketch/markup
- text/voice prompts
- image generation/editing
- style studies
- concept 3D
- render studies
- comparison boards
- branch alternatives
- comments
- decision history

Canvas artifacts are exploratory until promoted.

## D. Building Workspace

Purpose: authoritative design and technical work.

Views:
- plan
- 3D
- elevation
- section
- material
- rules
- BIM status
- MEP coordination
- technical drawings
- BOQ/cost
- validation
- versions

## E. Validation & Approval Center

Purpose: prove every authoritative commit is safe enough to proceed.

Each change shows:
- intent
- affected objects
- before/after
- geometry checks
- dimension checks
- material checks
- project/company rule checks
- code/regulation checks when sourced
- structure impacts
- MEP impacts
- documentation impacts
- BOQ/cost impacts
- provenance
- confidence
- recommended fixes

Actions:
- Edit
- Try Alternative
- Re-run Checks
- Approve
- Reject
- Waive with reason when policy allows

## F. Materials Intelligence

Material records may contain:
- ARCHON material code
- generic category
- brand/manufacturer
- product/series/SKU
- dimensions/thickness
- physical properties
- finish
- texture maps
- render representation
- Revit representation
- SketchUp representation
- specification
- installation assembly
- supplier
- price history
- lead time
- suitable/unsuitable applications
- project usage history

Users can create custom materials from references and generate controlled visual variants without losing the parent material identity.

## G. Knowledge & Design DNA

Sources:
- approved company standards
- finished projects
- approved details
- material/vendor data
- regulations
- curated external research
- client standards

ARCHON should propose lessons such as:

> "This circulation correction has occurred in 8 restaurant projects. Save 1000 mm as the Mark Studios restaurant default?"

No learning candidate becomes company truth without approval.

## H. Documentation Center

Outputs:
- plans
- reflected ceiling plans
- elevations
- sections
- enlarged plans
- door/window schedules
- finish schedules
- furniture/shop drawings
- joinery details
- construction details
- MEP drawings
- revision sets
- PDF/DWG delivery

## I. Construction Intelligence

Capabilities:
- assemblies
- installation details
- method statements
- QC checklist
- quantities
- RAB/BOQ
- value engineering
- procurement references
- field issue tracking in later phases

---

# Primary user journeys

## Journey 1 — Start a project

```text
New Project
-> speak/type brief
-> ARCHON structures requirements
-> user edits
-> ARCHON generates rules/checklist
-> approval
-> Brief Baseline v1
```

## Journey 2 — Generate layout alternatives

```text
Approved Program
-> generate A/B/C
-> scores + reasoning
-> compare
-> mark up
-> revise
-> select
-> Promote to Building Model
-> validate
-> approve
```

## Journey 3 — Modify existing design

```text
select wall / room / furniture
-> voice/text/markup instruction
-> intent resolution
-> Design Locks
-> sandbox change
-> impact analysis
-> validation checklist
-> alternatives if conflict
-> approve
-> commit
-> sync adapters
```

## Journey 4 — Explore interior style

```text
approved geometry
-> lock geometry
-> generate material/style alternatives
-> compare
-> select material identities
-> promote material changes
-> validation
-> approval
```

## Journey 5 — Generate technical package

```text
approved Building Model
-> choose issue package
-> dependency analysis
-> generate/rebuild affected views
-> drawing QA
-> checklist
-> approval
-> issue PDF/DWG
```

---

# Differentiation strategy

ARCHON should not compete only on AI rendering.

The durable differentiation is the continuous chain:

```text
Creative AI
+ Semantic Architecture
+ Validation
+ Provenance
+ BIM Synchronization
+ Technical Documentation
+ Construction Intelligence
+ Studio Operations
```

## Competitive principles adopted from modern AI design platforms

We want:
- visual canvas exploration
- multi-model orchestration
- reusable workflows
- visual annotation
- rapid image/style iteration
- concept 3D
- firm-specific creative intelligence
- collaboration

ARCHON extends these with:
- canonical building truth
- explicit promotion boundary
- deterministic validation
- rule provenance
- multi-software synchronization
- BIM/documentation consequences
- MEP/cost/construction impacts
- approvals and version governance

---

# AI Agent map

ARCHON appears to the user as one assistant, but internally may coordinate specialized capabilities.

Initial logical agents:
- Architect Agent
- Interior Agent
- Space Planning Agent
- Design Critic
- Materials Agent
- Lighting Agent
- BIM Agent
- Documentation Agent
- MEP Agent
- Cost Agent
- Knowledge/Research Agent
- Project Operations Agent
- Reliability/Conflict Agent

These are logical roles, not necessarily separate models or services.

---

# Stage gates

## Gate 0 — Brief Approval
Confirms project requirements and source rules.

## Gate 1 — Layout Approval
Confirms selected spatial solution.

## Gate 2 — Concept/Style Approval
Confirms design direction and material intent.

## Gate 3 — Design Development Approval
Confirms authoritative geometry and systems coordination level.

## Gate 4 — Technical Documentation Approval
Confirms drawings/specifications are ready for issue.

## Gate 5 — Construction/Tender Issue
Locks an issue baseline and tracks later revisions explicitly.

---

# Product success criteria

ARCHON succeeds when it reduces:
- time spent translating decisions between software
- repeated drafting after revisions
- inconsistency between model/drawings/BOQ
- undocumented design decisions
- late conflict discovery
- repetitive material searching
- project timeline uncertainty

and improves:
- alternatives explored
- decision traceability
- technical consistency
- design quality review
- project predictability
- reuse of studio knowledge

---

# Near-term product boundary

The first Replit build remains intentionally small.

It proves:
- Project Genesis
- canonical state
- ChangeSet
- validation/provenance
- approval
- immutable versions
- audit
- adapter contracts
- Canvas/Building separation in the domain model

It does **not** yet build full CAD/BIM generation.

This prevents the project from producing a beautiful demo on top of an unreliable core.
