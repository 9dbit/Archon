# ARCHON — Replit Master Build Prompt v0.1

Paste the prompt below into Replit Agent **with Plan mode enabled first** after importing `https://github.com/9dbit/Archon`.

---

## PROMPT START

You are the implementation agent for **ARCHON — The AI Operating System for Architecture**.

You are working in this GitHub repository:

`https://github.com/9dbit/Archon`

### 0. First action: do not code immediately

Before writing code:

1. Read these repository documents completely:
   - `README.md`
   - `docs/01_BUILD_PLAN.md`
   - `docs/02_SYSTEM_ARCHITECTURE.md`
   - `docs/03_VALIDATION_APPROVAL.md`
   - `docs/04_API_REGISTRY.md`
   - `docs/05_REPLIT_MASTER_PROMPT.md`
2. Inspect the repository and current Git branch/status.
3. Produce a concise implementation plan for **Phase 0 + the smallest usable slice of Phase 1 only**.
4. List assumptions and risks.
5. Do NOT implement SketchUp, Revit, AutoCAD, V-Ray or Rhino integrations in this first build. Create adapter contracts/mocks only.
6. Do NOT build microservices. Start with a modular monolith that can later split cleanly.
7. Show the plan for review before starting implementation if Replit Plan mode supports approval.

### 1. Product objective for this build

Build the first runnable ARCHON application where a user can:

1. Create an architecture project.
2. Enter an architectural brief in natural language or manually edit structured fields.
3. Convert the brief into a structured project draft using a deterministic/mock parser first, with an optional OpenAI implementation behind an interface if `OPENAI_API_KEY` exists.
4. Review/edit structured project requirements.
5. Create project rules/constraints.
6. Produce a proposed ChangeSet rather than mutating approved state directly.
7. Run a Validation Gate.
8. Show an editable review checklist with PASS/WARNING/BLOCKER states and source/provenance.
9. Approve or reject the ChangeSet.
10. On approval, create a new immutable project version and audit event.
11. View version history and the current approved baseline.

This is the first proof that ARCHON's governance model works. Do not attempt full generative architecture yet.

### 2. Required architecture

Use **TypeScript end-to-end**.

Recommended initial stack:
- Next.js with App Router
- TypeScript strict mode
- React
- Tailwind CSS
- PostgreSQL
- Drizzle ORM (or an equivalently lightweight typed ORM if Replit's environment strongly favors another option; document the choice)
- Zod for runtime/domain validation
- Vitest for unit/domain tests
- Playwright for a small critical-flow E2E test if practical in Replit

Use the simplest reliable Replit-compatible setup.

Suggested logical structure:

```text
apps/
  web/
packages/
  domain/
  db/
  validation/
  adapters/
  ai/
  ui/
  shared/
docs/
```

If a monorepo adds avoidable friction in Replit, keep one Next.js app but preserve these boundaries as directories/modules. Prefer clarity and runnable code over ceremonial complexity.

### 3. Domain model required in Phase 0

Implement typed schemas/entities for at least:

#### Project
- id
- name
- status
- buildingType
- locationText
- createdAt
- updatedAt
- currentApprovedVersionId

#### ProjectBrief
- projectId
- site dimensions/area
- number of levels
- floor-to-floor heights
- target GFA optional
- room/program requirements
- setbacks
- circulation requirements
- door standards
- window standards
- notes

#### CanonicalObject
Initial generic semantic object foundation:
- archonId immutable
- projectId
- objectType
- parameters JSON with typed wrapper
- relationships
- revision
- provenance
- confidence optional

Do not overbuild geometry yet.

#### ProjectRule
- id
- projectId
- code
- category
- description
- operator/constraint form where possible
- expected value
- unit
- source type
- source reference
- severity when violated
- active revision

#### ChangeSet
States must include at least:
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

Fields:
- id
- projectId
- baseVersionId
- source: USER_TEXT | USER_FORM | VOICE_PLACEHOLDER | EXTERNAL_ADAPTER | AI
- intent summary
- typed operations
- createdBy
- timestamps
- state

#### ValidationCheck
- id
- changeSetId
- category
- status: PASS | WARNING | BLOCKER | CRITICAL
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

#### Approval
- id
- changeSetId
- decision
- reviewer
- note
- timestamp

#### ProjectVersion
- id
- projectId
- version number
- parentVersionId
- canonical snapshot or deterministic reference to state
- approvedChangeSetId
- timestamp

#### AuditEvent
Append-only event for important transitions.

### 4. Immutable workflow rule

Never let a form or AI output directly overwrite approved project state.

Required flow:

```text
User input
 -> draft structured brief
 -> Proposed ChangeSet
 -> sandboxed proposed state
 -> Validation Gate
 -> checklist
 -> edit/fix if needed
 -> explicit approval
 -> commit new ProjectVersion
 -> update current approved baseline
 -> audit event
```

A rejected/failed ChangeSet must leave the approved baseline unchanged.

### 5. Initial deterministic validations

Implement enough real rules to prove the framework:

1. All dimensions must be positive.
2. Site width/depth must be within reasonable configured numeric bounds.
3. Floor-to-floor height must be positive and produce warnings below a configurable project threshold.
4. Door width/height rules can be checked when values exist.
5. Window sill/head values must be internally geometrically consistent when supplied.
6. Circulation minimum rules must validate against supplied/project values where applicable.
7. Unit must be explicit for dimensional rules.
8. Required source/provenance must exist for project rules before they can block approval.
9. A CRITICAL/BLOCKER check prevents normal approval until fixed or explicitly handled according to the policy.

Make validators pure/testable functions where practical.

### 6. AI boundary

Create an interface such as:

```ts
interface ArchitecturalIntentInterpreter {
  interpretBrief(input: string): Promise<StructuredBriefProposal>
}
```

Implement:
- `MockIntentInterpreter` as the default so the system works without paid APIs.
- optional `OpenAIIntentInterpreter` only if the environment has `OPENAI_API_KEY`.

The AI implementation must return typed structured proposals validated with Zod.

Never execute arbitrary generated code.
Never let LLM text become an authoritative dimension/rule without validation and user review.

### 7. Adapter boundary

Define the common adapter contract from `docs/02_SYSTEM_ARCHITECTURE.md`.

Create mock adapters:
- SketchUpMockAdapter
- RevitMockAdapter
- AutoCADMockAdapter

The mocks should demonstrate:
- health state
- capability declaration
- preview
- validate
- simulated sync/reconciliation

Do not call real vendor APIs yet.

### 8. UI direction

The first application should already feel like ARCHON, not a generic admin dashboard.

Desktop layout concept:

```text
+-------------------------------------------------------------+
| ARCHON | Project | Stage | Sync Health | Version            |
+----------------+--------------------------+------------------+
|                |                          |                  |
| AI COMMAND     | MAIN WORKSPACE           | CONTEXT /        |
| CENTER         |                          | VALIDATION       |
|                | Phase 1: project brief   |                  |
| text input     | structured requirements  | checklist        |
| future voice   | future 2D/3D viewport    | issues           |
| history        |                          | source/evidence  |
|                |                          | approval         |
+----------------+--------------------------+------------------+
| VERSION / DECISION TIMELINE                                  |
+-------------------------------------------------------------+
```

Design goals:
- professional architecture software aesthetic
- dark-neutral or restrained premium interface
- information dense but calm
- clear PASS/WARNING/BLOCKER states
- large central workspace
- architecture-specific terminology
- responsive enough for laptop/tablet, but desktop is primary

Do not spend the entire first build on visual polish. Domain correctness is higher priority.

### 9. Required screens/routes

At minimum:

1. `/` — project list / dashboard
2. `/projects/new` — Project Genesis
3. `/projects/[id]` — project workspace
4. workspace tabs/sections:
   - Brief
   - Rules
   - Changes
   - Validation
   - Versions
   - Integrations (mock status)

### 10. Version & commit UX

When the user proposes a change:
- show what changed
- show base version
- run validation
- show checklist
- allow editing before approval
- require an explicit `Approve Commit` action
- on success display new version number

For rejected changes, show that approved baseline was not modified.

### 11. Database and migrations

Use PostgreSQL and migrations.

Do not rely on local filesystem persistence for production project data.

Seed a demo project demonstrating:
- restaurant brief
- several project rules
- one approved version
- one pending ChangeSet with warnings

### 12. Security/reliability basics

For this first build:
- environment secrets must not be committed
- validate all API inputs
- generate IDs server-side
- append audit events
- use idempotency where commit endpoint can be retried
- database transaction for canonical commit where possible
- no arbitrary eval/exec
- clear error boundary/UI

### 13. Tests required before declaring Phase 0 complete

Write tests for at least:
- ChangeSet does not mutate approved state before approval
- failed validation leaves baseline unchanged
- approved valid ChangeSet creates a new version
- validation correctly blocks invalid dimension/rule case
- provenance/source is included in validation output
- adapter mock can fail without corrupting canonical approved state
- repeated commit request is safely handled/idempotent

Run lint, typecheck and tests.

### 14. Git discipline

Before editing:
- run `git status -sb`
- do not overwrite unrelated changes

If currently on `main`, create a working branch such as:
`agent/replit-phase-0-foundation`

Use small checkpoint commits after tests pass.

Do not merge to `main` automatically.

### 15. Replit environment

Configure the app so Replit can run it with a clear workflow/run command.

If database setup is required, use the supported Replit database workflow and document setup in README.

Secrets such as `OPENAI_API_KEY` must be added through Replit Secrets, never hard-coded.

### 16. Definition of Done for this Replit build

Do not say the build is complete until all of these are true:

- app launches successfully
- database migration succeeds
- demo data loads
- new project can be created
- brief can be entered/reviewed
- proposed ChangeSet can be generated
- validation checklist appears
- blocker prevents approval
- user can correct data and rerun validation
- explicit approval creates new version
- version history works
- mock integrations display health/capabilities
- lint passes
- typecheck passes
- unit/domain tests pass
- README includes Replit run/setup instructions

At completion, report:
1. files/modules created
2. architecture decisions made
3. commands/tests run and their results
4. known limitations
5. exact recommended next milestone

### 17. Important scope boundary

Do NOT implement real SketchUp/Revit/AutoCAD integrations during this build.
Do NOT implement true CAD/BIM geometry generation yet.
Do NOT implement full MEP or BOQ yet.
Do NOT silently relax validation to make tests pass.

The purpose of this first milestone is to make the **ARCHON canonical change + validation + approval + versioning loop unquestionably solid**.

## PROMPT END
