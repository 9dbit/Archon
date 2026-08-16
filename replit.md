# ARCHON — Replit Agent Context

## Mission
Build ARCHON as an AI-first architecture operating system. GitHub is the source-of-code truth; Replit is the implementation environment.

## Mandatory project context
Before implementing anything, read these files completely:
- `docs/01_BUILD_PLAN.md`
- `docs/02_SYSTEM_ARCHITECTURE.md`
- `docs/03_VALIDATION_APPROVAL.md`
- `docs/04_API_REGISTRY.md`
- `docs/05_REPLIT_MASTER_PROMPT.md`
- `docs/06_REPLIT_START_HERE.md`
- `docs/07_PRODUCT_PLAN_V2.md`
- `docs/08_UI_WORKSPACE_SPEC.md`
- `docs/09_AI_ROUTER_DESIGN_DNA.md`
- `docs/10_REPLIT_GITHUB_SYNC.md`

## Non-negotiable architecture rules
1. ARCHON Canonical Model is authoritative for design intent, rules, versions and approvals.
2. Canvas/exploration state is non-authoritative until promoted.
3. Promotion path is: Explore -> Promote -> Validate -> Review/Edit -> Approve -> Commit.
4. No critical change may mutate approved state directly.
5. Every authoritative change is a ChangeSet.
6. Every ChangeSet must pass Validation Gate and produce an editable checklist with provenance.
7. Explicit approval is required before authoritative commit.
8. Every commit creates a recoverable project version and audit trail.
9. External software is integrated through adapters. No direct SketchUp↔Revit↔AutoCAD sync.
10. Adapter failure must never corrupt approved canonical state.
11. AI output is proposal, not truth. Deterministic checks and approved sources take precedence.
12. Do not implement real SketchUp/Revit/AutoCAD/V-Ray/Rhino integrations in Phase 0.

## GitHub workflow
- Never work directly on `main`.
- Pull latest `main` before starting a coding session.
- Work on an `agent/*` branch, initially `agent/replit-phase-0-foundation`.
- Make small checkpoint commits only after relevant tests pass.
- Push each stable checkpoint to GitHub.
- Open a draft PR to `main` when the milestone is ready for review.
- Do not merge the PR automatically.
- If there is a merge conflict or architecture ambiguity, stop and document it in the PR or linked issue instead of silently choosing a destructive resolution.

## Current milestone
Phase 0 + smallest usable Project Genesis slice.

Required user flow:
Project Genesis -> Structured Brief -> Proposed ChangeSet -> Sandbox -> Validation -> Checklist -> Review/Edit -> Approval -> Immutable Version -> Audit.

## Definition of done
- App boots in Replit.
- Durable PostgreSQL persistence works.
- New project can be created.
- Brief can be entered and edited.
- Proposed ChangeSet does not mutate approved state.
- Validation checklist supports PASS/WARNING/BLOCKER/CRITICAL and provenance.
- Blockers prevent normal approval.
- Corrected proposal can be revalidated.
- Explicit approval creates a new immutable version.
- Version/audit history works.
- Mock SketchUp/Revit/AutoCAD adapters expose health/capabilities and simulated failure.
- Simulated adapter failure does not corrupt approved state.
- lint, typecheck and tests pass.

## Communication discipline
Use GitHub artifacts as the communication bridge with ChatGPT:
- implementation status -> commits / PR description
- blockers -> GitHub issue or PR comment
- assumptions -> PR description
- architecture decisions -> docs / ADR
- test evidence -> PR description and CI output

Keep `replit.md` updated only with durable project context. Do not replace the authoritative architecture documents with informal notes.