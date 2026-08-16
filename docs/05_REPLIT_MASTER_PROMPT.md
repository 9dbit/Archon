# ARCHON — Replit Master Build Prompt v0.2

Use this prompt after importing `https://github.com/9dbit/Archon` into Replit. Start in **Plan mode**.

---

## PROMPT START

You are the implementation agent for **ARCHON — The AI Operating System for Architecture**.

Repository:
`https://github.com/9dbit/Archon`

## 0. Read before coding

Read completely:
- `README.md`
- `docs/01_BUILD_PLAN.md`
- `docs/02_SYSTEM_ARCHITECTURE.md`
- `docs/03_VALIDATION_APPROVAL.md`
- `docs/04_API_REGISTRY.md`
- `docs/05_REPLIT_MASTER_PROMPT.md`
- `docs/06_REPLIT_START_HERE.md`
- `docs/07_PRODUCT_PLAN_V2.md`
- `docs/08_UI_WORKSPACE_SPEC.md`
- `docs/09_AI_ROUTER_DESIGN_DNA.md`

Then:
1. inspect repository status and current branch;
2. produce a concise Phase 0 + smallest Phase 1 implementation plan;
3. list assumptions and risks;
4. do not implement real SketchUp/Revit/AutoCAD/V-Ray/Rhino integrations yet;
5. do not implement full Canvas, CAD/BIM geometry, MEP or BOQ yet;
6. preserve the architecture so those modules can be added cleanly;
7. show the implementation plan for review if Plan mode supports it.

## 1. Product architecture that must be preserved

ARCHON has two different state domains:

### Exploration State — Canvas
Non-authoritative creative artifacts such as references, alternatives, sketches, generated images and concept 3D.

### Authoritative State — Building Model
Validated semantic project truth such as dimensions, rules, building objects, materials and approved project versions.

A Canvas artifact may only become authoritative through:

```text
Select -> Promote -> Proposed ChangeSet -> Validation -> Review/Edit -> Approval -> Commit
```

Do not allow exploratory outputs to silently mutate approved Building Model state.

## 2. Objective for this first build

Build a runnable ARCHON application where a user can:

1. Create a project.
2. Enter an architectural brief using text or structured fields.
3. Convert it into a structured project proposal.
4. Review/edit the structured proposal.
5. Create project rules/constraints.
6. Produce a Proposed ChangeSet instead of mutating approved state.
7. Run Validation Gate.
8. Review an editable checklist with PASS/WARNING/BLOCKER/CRITICAL states and provenance.
9. Approve or reject the ChangeSet.
10. On approval create a new immutable ProjectVersion and AuditEvent.
11. View current approved baseline and version history.
12. See a minimal placeholder distinction between **Canvas Mode** and **Building Mode**.
13. Store minimal CanvasArtifact records so exploration and authoritative state are separated at the data-model level.
14. Display mock external adapter health/capabilities.

This milestone proves governance and data architecture, not generative architecture.

## 3. Technology direction

Use TypeScript end-to-end.

Recommended:
- Next.js App Router
- TypeScript strict mode
- React
- Tailwind CSS
- PostgreSQL
- Drizzle ORM or equivalent typed ORM
- Zod
- Vitest
- Playwright for a small critical E2E flow if practical

Start as a modular monolith.

Logical boundaries should include:

```text
app / apps-web
 domain
 db
 canvas
 promotion
 validation
 adapters
 ai
 knowledge
 ui
 shared
```

Do not create microservices yet.

## 4. Required Phase 0 domain entities

### Project
- id
- name
- status
- buildingType
- locationText
- currentApprovedVersionId
- createdAt
- updatedAt

### ProjectBrief
- projectId
- site dimensions/area
- levels
- floor-to-floor heights
- target GFA optional
- program requirements
- setbacks
- circulation requirements
- door standards
- window standards
- notes

### CanvasArtifact
Minimal foundation only:
- id
- projectId
- artifactType
- title
- status
- parentArtifactIds
- sourceType
- sourceReference optional
- metadata JSON
- promotionStatus
- createdAt

Do not build full Infinite Canvas yet.

### CanonicalObject
- archonId immutable
- projectId
- objectType
- parameters
- relationships
- revision
- provenance
- confidence optional

### ProjectRule
- id
- projectId
- code
- category
- description
- operator/constraint form where possible
- expected value
- unit
- sourceType
- sourceReference
- severity
- active revision

### ChangeSet
States include at least:
- DRAFT
- PROPOSED
- SANDBOXED
- VALIDATING
- NEEDS_REVIEW
- APPROVED
- REJECTED
- COMMITTING
- COMMITTED
- VALIDATION_FAILED

Fields include:
- id
- projectId
- baseVersionId
- source
- intent summary
- typed operations
- affected domains
- requested locks optional
- createdBy
- timestamps
- state

### ValidationCheck
- id
- changeSetId
- category
- status PASS | WARNING | BLOCKER | CRITICAL
- severity
- observed value
- expected value
- unit
- sourceType
- sourceReference
- evidence/provenance
- recommendation
- confidence optional
- reviewerNote optional
- waiverReason optional

### Approval
- id
- changeSetId
- decision
- reviewer
- note
- timestamp

### ProjectVersion
- id
- projectId
- version number
- parentVersionId
- canonical snapshot or deterministic reference
- approvedChangeSetId
- timestamp

### AuditEvent
Append-only event for important transitions.

## 5. Immutable workflow

Required flow:

```text
User input
-> draft structured brief
-> Proposed ChangeSet
-> sandboxed proposed state
-> Validation Gate
-> checklist
-> edit/fix
-> explicit approval
-> commit new ProjectVersion
-> update approved baseline
-> audit event
```

Rejected/failed ChangeSet leaves approved baseline unchanged.

## 6. Initial deterministic validations

Implement enough real checks to prove the framework:
- dimensions positive
- site dimensions reasonable/configured
- floor-to-floor positive and configurable warning threshold
- door width/height checks where supplied
- window sill/head consistency
- circulation minimum checks
- explicit dimensional units
- blocking rules require provenance
- blocker/critical prevents normal approval
- CanvasArtifact itself cannot directly mutate authoritative state
- promotion placeholder must create a Proposed ChangeSet, not a direct canonical mutation

Validators should be pure/testable where practical.

## 7. AI boundary

Create a provider-independent interface for architectural intent interpretation.

Implement:
- deterministic/mock interpreter by default
- optional OpenAI implementation only when credential is present

Also define, but do not fully implement, an `AIModelRouter` boundary that can later route reasoning, realtime voice, image, 3D, retrieval and optimization tasks.

All AI outputs must be typed/validated before domain use.
No arbitrary eval/exec.
No AI text becomes authoritative dimensions/rules without Validation + Approval.

## 8. Design Lock foundation

Define a typed representation for lockable domains:
- geometry
- structure
- layout
- openings
- furniture
- materials
- lighting
- camera
- documentation
- rules

Do not build sophisticated enforcement yet, but include affected-domain and requested-lock fields in ChangeSet so the architecture is ready.

## 9. Adapter boundary

Implement common adapter contract from system architecture.

Create mocks only:
- SketchUpMockAdapter
- RevitMockAdapter
- AutoCADMockAdapter

Mocks demonstrate:
- health
- capabilities
- preview
- validation
- simulated sync
- reconciliation
- controlled failure

A failed adapter must never corrupt approved canonical state.

## 10. UI direction

The first app must feel like ARCHON rather than a generic admin dashboard.

Desktop shell:

```text
+-------------------------------------------------------------+
| ARCHON | Project | Stage | Mode | Sync | Version            |
+----------------+--------------------------+------------------+
| AI COMMAND     | MAIN WORKSPACE           | CONTEXT /        |
| CENTER         |                          | VALIDATION       |
|                | Brief / Canvas placeholder|                 |
| text           | Building workspace       | checklist        |
| voice future   |                          | sources          |
| history        |                          | approval         |
+----------------+--------------------------+------------------+
| VERSION / DECISION TIMELINE                                  |
+-------------------------------------------------------------+
```

Required visual distinction:
- Canvas Mode = exploratory/non-authoritative
- Building Mode = authoritative/validated

Do not build a sophisticated node editor in this milestone.

## 11. Required routes

At minimum:
- `/` dashboard/project list
- `/projects/new` Project Genesis
- `/projects/[id]` workspace

Workspace areas:
- Brief
- Canvas (minimal placeholder + stored artifacts)
- Building
- Rules
- Changes
- Validation
- Versions
- Integrations

## 12. Version/commit UX

When proposing change:
- show before/after
- base version
- affected domains
- validation checklist
- source/provenance
- edit before approval
- explicit `Approve Commit`
- new version after success

Never blur AI suggestion and approved truth.

## 13. Database

Use PostgreSQL migrations.
Do not use local filesystem for production project state.

Seed a restaurant demo with:
- brief
- several project rules
- approved version
- pending ChangeSet
- one CanvasArtifact alternative
- validation warnings

## 14. Reliability/security basics

- secrets never committed
- validate API inputs
- server-generated IDs
- append audit events
- idempotent commit behavior
- transaction for canonical commit where possible
- no arbitrary code execution
- error boundaries
- last approved state remains recoverable

## 15. Tests required

At least:
- ChangeSet does not mutate approved state before approval
- failed validation leaves baseline unchanged
- valid approved ChangeSet creates version
- blocker prevents approval
- provenance appears in validation output
- mock adapter failure cannot corrupt canonical state
- repeated commit is idempotent
- CanvasArtifact remains non-authoritative
- promotion placeholder produces proposal rather than direct mutation

Run lint + typecheck + tests.

## 16. Git discipline

If on `main`, create a working branch such as:
`agent/replit-phase-0-foundation`

Use small checkpoint commits.
Do not merge to main automatically.

## 17. Definition of Done

Do not declare complete until:
- app launches
- database migration works
- seed loads
- new project works
- brief review/edit works
- Canvas vs Building distinction is visible
- minimal CanvasArtifact can be stored
- Proposed ChangeSet works
- Validation checklist works
- blocker prevents approval
- user can correct and rerun
- approval creates new version
- version history works
- mock integrations display health
- adapter failure test passes
- lint passes
- typecheck passes
- tests pass
- README contains Replit setup/run instructions

At completion report:
1. modules created
2. architecture decisions
3. validation/test results
4. known limitations
5. next recommended milestone

## 18. Hard scope boundary

Do NOT yet implement:
- real SketchUp/Revit/AutoCAD integration
- full Infinite Canvas/node editor
- real CAD/BIM generation
- full MEP
- full BOQ
- V-Ray/Rhino integration
- automatic Design DNA learning

The first milestone exists to make ARCHON's **exploration separation + canonical change + validation + approval + versioning** foundation reliable.

## PROMPT END
