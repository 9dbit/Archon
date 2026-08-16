# ARCHON Validation & Approval Protocol v0.1

## Rule

No authoritative project change may advance to the next project process until it passes applicable checks, exposes the checklist and evidence to the user, allows edits, and receives the required approval.

## Source-of-truth hierarchy for checks

Each validation result must cite its source category and source identifier.

Sources may include:
1. Approved project brief.
2. Approved project rules.
3. Company standards.
4. Verified regulatory rules applicable to the project jurisdiction.
5. Manufacturer/product specifications.
6. Approved material library records.
7. Approved discipline models and engineering requirements.
8. Approved design decisions and baselines.
9. Validated external references/knowledge with provenance.

AI opinion alone is never a rule source.

## Validation families

### Geometry
- collision/intersection
- duplicate/overlapping objects
- connectivity
- room closure
- host relationships
- void/opening validity
- clearance envelopes
- level/elevation consistency
- coordinate transform consistency

### Size & dimensions
- exact dimensions
- minimum/maximum constraints
- clear widths
- ceiling heights
- door/window parameters
- sill/head heights
- circulation distances
- tolerances where defined

### Semantics
- object type remains valid
- required parameters present
- relationships valid
- no conversion to meaningless generic geometry without explicit proxy status

### Materials
- material exists in approved library
- manufacturer/series/code
- intended use compatibility
- thickness/assembly
- finish
- installation method
- render mapping
- BOQ mapping
- technical specification provenance

### Design rules
- project constraints
- company design DNA
- building-type rules
- accessibility
- circulation
- operational workflow
- user-defined custom checks

### Structure
- column/beam conflicts
- structural openings
- protected/locked structural elements
- engineering-review requirement

### MEP
- duct/pipe/cable conflicts
- equipment clearances
- fixture dependencies
- outlet/device relocations
- ceiling coordination

### Documentation
- affected views detected
- dimensions consistent
- tags/schedules consistent
- detail references valid
- stale drawings detected

### Cost / quantity
- quantity deltas
- material deltas
- cost-impact estimate
- confidence/source of estimate

### Render / presentation
Derived asset freshness only unless a presentation choice is promoted into a project/material decision.

## Severity

- INFO — no action required.
- WARNING — review recommended.
- BLOCKER — cannot approve until resolved or explicitly waived by an authorized role with recorded reason.
- CRITICAL — commit stopped; potential data integrity, life-safety, structural or major coordination risk.

## Confidence

Every AI-derived interpretation or recommendation stores a confidence score and provenance.

Low confidence cannot auto-commit a critical change.

## Checklist data model

Each check includes:
- check ID
- category
- status
- severity
- object IDs
- observed value
- expected/rule value
- source ID
- evidence/provenance
- suggested fixes
- confidence
- reviewer note
- waiver reason if applicable

## Required workflow

```text
Proposed Change
    |
    v
Sandbox
    |
    v
Run checks
    |
    v
Generate editable checklist
    |
    +--> BLOCKER/CRITICAL -> Edit/Fix -> Re-run
    |
    v
User/discipline review
    |
    v
Explicit approval
    |
    v
Commit canonical version
    |
    v
Synchronize adapters
    |
    v
Reconcile
    |
    v
Post-sync verification
```

## Approval model

Initial statuses:
- DRAFT
- REVIEW_REQUIRED
- APPROVED
- APPROVED_WITH_WAIVER
- REJECTED

Project-stage approvals may include:
- Brief
- Layout
- Concept Design
- Design Development
- Technical Documentation
- Tender/Construction Issue

Later versions may add discipline approvals:
- Architecture
- Interior
- Structure
- MEP
- Cost

## Post-sync verification

Approval before sync does not imply external applications synced successfully.

After execution, ARCHON must verify:
- expected object revision exists in each required adapter
- adapter reports no execution error
- expected dimensions/parameters match
- derived assets are current or explicitly marked stale

Only after reconciliation can a ChangeSet become `COMMITTED`.
