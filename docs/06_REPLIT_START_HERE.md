# ARCHON — Replit Start Here

## Goal

Use Replit as the implementation environment while GitHub remains the code repository and review/merge history.

## Step 1 — Merge the foundation documentation

Review the foundation PR containing:
- build plan
- system architecture
- validation/approval protocol
- API registry
- Replit master prompt

Merge only when these principles are accepted, because Replit Agent is instructed to treat them as implementation contracts.

## Step 2 — Import the GitHub repository into Replit

Repository:

`https://github.com/9dbit/Archon`

Use Replit's GitHub import flow and connect the GitHub account with access to the repository.

Replit official import documentation:
https://docs.replit.com/build/import-from-providers

Important: GitHub import does not copy secret values. Add secrets separately in Replit.

## Step 3 — Enable Plan mode before code generation

Open Replit Agent and enable Plan mode.

Paste the full contents of:

`docs/05_REPLIT_MASTER_PROMPT.md`

The first Agent response should be an implementation plan, not a giant code dump.

Official Replit Agent guidance:
https://docs.replit.com/learn/build-with-agent

## Step 4 — Review the Agent plan

Before allowing implementation, verify the plan:

- implements Phase 0 + smallest Phase 1 slice only
- does not build real SketchUp/Revit/AutoCAD integrations yet
- preserves Canonical Model boundaries
- implements ChangeSet lifecycle
- implements Validation Gate
- implements explicit approval
- implements version/audit history
- includes tests
- uses PostgreSQL rather than production filesystem persistence

If any item is missing, ask Replit Agent to revise its plan before implementation.

## Step 5 — Git branch

Before implementation:

```bash
git status -sb
git branch --show-current
```

If working from `main`, create:

```bash
git checkout -b agent/replit-phase-0-foundation
```

Do not auto-merge to `main`.

## Step 6 — Scaffold and run the application

Let Agent choose the least-friction Replit-compatible TypeScript setup consistent with the master prompt.

Required first success condition:
- application boots
- database connects
- migration works
- basic ARCHON workspace renders

## Step 7 — Database

Use PostgreSQL for durable application data.

Do not rely on the deployed application's local filesystem as project persistence.

Replit deployment documentation:
https://docs.replit.com/learn/projects-and-artifacts/replit-deployments

## Step 8 — Secrets

Add only secrets actually needed for the current phase.

Likely later/optional:

```text
OPENAI_API_KEY
```

Do not add Autodesk, V-Ray or Rhino credentials until their integration milestone begins.

Never commit secret values.

## Step 9 — Build by vertical slices

Recommended implementation checkpoints:

### Checkpoint A — Foundation
- app shell
- DB
- domain schemas
- migrations
- seed
- health endpoint

### Checkpoint B — Change governance
- ChangeSet creation
- sandbox state
- validation results
- checklist
- approval/rejection
- version creation
- audit events

### Checkpoint C — Project Genesis
- new project
- natural-language brief input
- structured editable brief
- rules
- mock/optional AI interpreter

### Checkpoint D — Integration boundary
- adapter interface
- SketchUp/Revit/AutoCAD mocks
- adapter health UI
- simulated failure/reconciliation test

After each checkpoint:

```text
lint
+ typecheck
+ tests
+ manual UI smoke test
```

Only commit a checkpoint when the checks pass.

## Step 10 — Required manual scenario before first PR

Run this scenario:

1. Create Restaurant Demo project.
2. Enter site and architecture brief.
3. Create a circulation/door/window rule.
4. Propose a change violating one rule.
5. Verify ARCHON creates a BLOCKER/WARNING with provenance.
6. Verify approved project state is unchanged.
7. Edit the proposal.
8. Rerun validation.
9. Approve Commit.
10. Verify a new immutable version exists.
11. Simulate an adapter failure.
12. Verify canonical approved state is not corrupted.

## Step 11 — Git checkpoint and push

Use small meaningful commits rather than one giant Agent commit.

Example:

```text
bootstrap ARCHON foundation
implement ChangeSet validation workflow
add Project Genesis MVP
add adapter mock reliability tests
```

Push the working branch and create a draft PR.

## Step 12 — Review gate before Phase 2

Do not start layout generation or real external software APIs until the first PR proves:

- canonical versioning is reliable
- validation is deterministic where required
- approval is explicit
- rollback/failure semantics are understood
- adapter mocks cannot corrupt approved state

Then start the Layout/Canonical Building Model milestone.
