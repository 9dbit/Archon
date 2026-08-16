# ARCHON — Replit Start Here v0.2

## Goal

Use Replit as the implementation environment while GitHub remains the code repository and review/merge history.

The first implementation must prove ARCHON's core architecture before real CAD/BIM integrations are added.

## Step 1 — Read the current architecture contracts

Replit Agent must read:
- `docs/01_BUILD_PLAN.md`
- `docs/02_SYSTEM_ARCHITECTURE.md`
- `docs/03_VALIDATION_APPROVAL.md`
- `docs/04_API_REGISTRY.md`
- `docs/05_REPLIT_MASTER_PROMPT.md`
- `docs/07_PRODUCT_PLAN_V2.md`
- `docs/08_UI_WORKSPACE_SPEC.md`
- `docs/09_AI_ROUTER_DESIGN_DNA.md`

Key principle:

```text
Canvas = exploration
Building Model = authoritative truth
```

A concept crosses that boundary only through Promote -> Validation -> Approval.

## Step 2 — Import GitHub repository

Repository:
`https://github.com/9dbit/Archon`

Use Replit GitHub import and connect the account that can access the repository.

Secret values must be added separately through Replit Secrets and never committed.

## Step 3 — Use Plan mode first

Open Replit Agent in Plan mode and use the full contents of:

`docs/05_REPLIT_MASTER_PROMPT.md`

The first output should be a plan, not a broad uncontrolled implementation.

## Step 4 — Verify the plan before build

Required:
- Phase 0 + smallest Phase 1 only
- Canvas/Building separation exists in the domain model
- minimal CanvasArtifact foundation only
- Canonical Model boundaries preserved
- ChangeSet lifecycle
- Validation Gate
- provenance
- explicit approval
- immutable version/audit history
- adapter mocks only
- tests
- PostgreSQL

Not allowed yet:
- real SketchUp/Revit/AutoCAD APIs
- full Infinite Canvas/node editor
- full BIM/CAD generation
- MEP/BOQ engines
- automatic Design DNA learning

## Step 5 — Working branch

Use a dedicated branch such as:

`agent/replit-phase-0-foundation`

Do not implement directly on `main` and do not auto-merge.

## Step 6 — First runnable checkpoint

Required first success condition:
- application boots
- database connects
- migration succeeds
- ARCHON workspace shell renders
- user can clearly see Canvas Mode vs Building Mode

## Step 7 — Persistence

Use PostgreSQL for durable project data.

The approved project baseline must not depend on local filesystem state.

## Step 8 — Secrets

Only add credentials required by the current milestone.

Optional first-phase secret:
- `OPENAI_API_KEY`

Do not add Autodesk/V-Ray/Rhino credentials yet.

## Step 9 — Build vertical slices

### Checkpoint A — Foundation
- app shell
- database
- typed domain schemas
- CanvasArtifact foundation
- CanonicalObject foundation
- migrations
- seed
- health status

### Checkpoint B — Change governance
- ChangeSet
- sandbox proposal
- validation results
- editable checklist
- review/edit
- approval/rejection
- ProjectVersion
- audit events

### Checkpoint C — Project Genesis
- new project
- brief input
- structured editable brief
- project rules
- deterministic/mock interpreter
- optional AI interpreter behind interface

### Checkpoint D — Canvas/Building boundary
- create/store simple CanvasArtifact
- label artifact non-authoritative
- promotion placeholder
- promotion creates Proposed ChangeSet
- no direct authoritative mutation

### Checkpoint E — Integration boundary
- adapter interface
- SketchUp/Revit/AutoCAD mocks
- health UI
- simulated failure/reconciliation

After every checkpoint:

```text
lint + typecheck + tests + manual UI smoke test
```

## Step 10 — Required manual scenario

1. Create Restaurant Demo.
2. Enter site/architecture brief.
3. Create an exploratory Canvas alternative.
4. Verify it is explicitly non-authoritative.
5. Promote it or a structured change as a Proposed ChangeSet.
6. Create circulation/door/window rule.
7. Make the proposal violate a rule.
8. Verify BLOCKER/WARNING includes provenance.
9. Verify approved baseline remains unchanged.
10. Correct the proposal.
11. Re-run validation.
12. Approve Commit.
13. Verify new immutable version exists.
14. Simulate adapter failure.
15. Verify approved canonical state is not corrupted.

## Step 11 — Git checkpoint

Use small meaningful commits and push a working branch.
Open a draft PR after checks pass.

## Step 12 — Gate before next milestone

Do not begin real layout generation or vendor APIs until Phase 0 proves:
- Canvas and Building truth cannot be accidentally mixed
- canonical versioning is reliable
- validation is deterministic where required
- provenance is available
- approval is explicit
- adapter failures cannot corrupt approved state

After that, proceed to ARCHON Canvas MVP + semantic layout engine.
