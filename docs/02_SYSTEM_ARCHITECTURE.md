# ARCHON System Architecture v0.2

## Architectural thesis

ARCHON synchronizes **meaning, identity, constraints, provenance and approved changes**. It does not synchronize files directly between authoring applications.

ARCHON has two intentionally separate state domains:

1. **Exploration State** — ARCHON Canvas artifacts, alternatives, prompts, references, style studies and concept 3D.
2. **Authoritative State** — Canonical Building Graph, rules, materials, BIM semantics, documentation dependencies and approved versions.

The bridge between them is the **Promotion Engine**.

```text
User / Voice / Markup / Reference
        |
        v
ARCHON Canvas Graph
        |
   AI Model Router
        |
        v
Alternatives / Artifacts / Concept 3D
        |
        v
SELECT + PROMOTE
        |
        v
Promotion Engine
        |
 semantic extraction / parameterization
        |
        v
Proposed ChangeSet
        |
        v
Validation Gate
        |
        v
Review / Edit / Approval
        |
        v
Canonical Building Graph
        |
        +--> Rules / Knowledge / Materials / Design DNA
        |
        v
Approved Version
        |
        v
Orchestration / Event Bus
    |          |          |
    v          v          v
SketchUp    Revit      AutoCAD
Adapter     Adapter     Adapter
    |          |          |
    +----------+----------+
               |
               v
        Reconciliation
               |
       Derived Asset Graph
 drawings / BOQ / render / reports
```

---

## Core bounded contexts

### 1. Identity Service
Creates immutable ARCHON IDs and external application mappings.

### 2. Canvas Graph
Stores non-authoritative creative artifacts and lineage.

A CanvasArtifact includes:
- id
- projectId
- artifactType
- parentArtifactIds
- source prompt / source asset references
- model/provider used
- parameters
- generated asset reference
- confidence where applicable
- author
- timestamp
- branch/alternative id
- promotion status

Canvas artifacts are never assumed to be buildable.

### 3. Canonical Building Graph
Stores semantic approved project state independently of authoring vendors.

Objects contain:
- immutable ARCHON identity
- object type
- parameters
- relationships
- constraints
- material references
- source/provenance
- revision
- confidence where AI-derived
- authoritative status

### 4. Promotion Engine
Converts selected Canvas artifacts into proposed authoritative semantic data.

Responsibilities:
- semantic extraction
- object recognition
- parameter inference
- dimension confidence
- relationship inference
- material mapping
- rule comparison
- proxy detection for unsupported geometry
- provenance capture
- ChangeSet generation

Promotion never commits automatically.

### 5. ChangeSet Engine
No critical mutation directly edits approved state.

States:

```text
DRAFT
-> PROPOSED
-> SANDBOXED
-> VALIDATING
-> NEEDS_REVIEW
-> APPROVED
-> COMMITTING
-> SYNCING
-> RECONCILING
-> COMMITTED
```

Failure states:

```text
VALIDATION_FAILED
SYNC_INCOMPLETE
CONFLICT
ROLLBACK_REQUIRED
ROLLED_BACK
```

### 6. Validation Engine
Runs deterministic and evidence-backed checks before approval.

Check domains include:
- geometry
- dimensions
- relationships
- room closure
- clearance
- accessibility
- structure
- MEP
- materials
- design rules
- project brief
- company standards
- regulation sources
- documentation consistency
- BOQ/cost implications
- provenance completeness

### 7. Approval Engine
Supports stage-specific, discipline-specific and final approvals.

### 8. Design Lock Engine
Prevents AI operations from editing protected domains.

Lockable scopes include:
- geometry
- structure
- room layout
- openings
- furniture
- materials
- lighting
- camera
- documentation annotations
- rules

Every AI request carries an explicit editable-scope declaration.

### 9. Dependency Graph
Tracks what depends on each object and which assets become stale after a change.

### 10. Adapter Gateway
Common contract for external software integrations.

```ts
interface ArchonAdapter {
  connect(): Promise<void>
  healthCheck(): Promise<AdapterHealth>
  capabilities(): Promise<AdapterCapabilities>
  pullChanges(cursor?: string): Promise<ExternalChange[]>
  preview(changeSet: ChangeSet): Promise<AdapterPreview>
  validate(changeSet: ChangeSet): Promise<AdapterValidationResult>
  pushChangeSet(changeSet: ChangeSet): Promise<AdapterExecutionResult>
  reconcile(changeSetId: string): Promise<ReconciliationResult>
  rollback(changeSetId: string): Promise<RollbackResult>
}
```

### 11. Orchestrator
Coordinates multi-adapter updates using saga-style workflows.

### 12. Reconciliation Engine
Compares expected canonical state with adapter-reported state and detects stale, missing, conflicting or simplified representations.

### 13. Reliability Layer
Required features:
- last-known-good versions
- snapshots/checkpoints
- retry policy
- idempotency keys
- adapter health
- timeouts
- circuit breakers
- fallback paths
- conflict resolution
- audit logs
- explicit partial-sync state

### 14. AI Model Router
Routes tasks to provider/model capabilities instead of hard-coding one AI vendor.

Task classes:
- reasoning / architecture critique
- realtime voice
- speech transcription
- image generation
- image editing
- 3D generation
- render enhancement
- video/walkthrough
- embeddings/retrieval
- parametric optimization

Routing considers:
- capability
- quality
- latency
- cost
- privacy
- provider health
- tenant/project policy

The router returns typed outputs into ARCHON domain contracts.

### 15. Design DNA Engine
Maintains approved reusable company/project preferences.

Domains:
- space planning patterns
- dimension tendencies
- material palettes
- furniture preferences
- lighting preferences
- detailing patterns
- visual style
- revision patterns
- workflow templates

Learning candidates require provenance and approval before becoming company rules or defaults.

### 16. Knowledge & Research Engine
Separates source retrieval from authoritative rule promotion.

Knowledge classes:
- project knowledge
- company standards
- manufacturer data
- regulations
- industry research
- precedent projects

Every knowledge item tracks source, date/freshness, confidence and scope.

---

## Authority model

| Domain | Default authority |
|---|---|
| ARCHON IDs | ARCHON |
| Canvas lineage | ARCHON |
| Design intent | ARCHON |
| Rules/constraints | ARCHON |
| Material specification | ARCHON |
| Version/audit | ARCHON |
| Design DNA | ARCHON |
| High-fidelity BIM representation | Revit adapter |
| Conceptual geometry representation | SketchUp/Canvas adapter |
| CAD annotation/layout | AutoCAD adapter |
| Render pixels | Render engine |

External changes remain proposals until reconciled, validated and approved.

---

## Change classes

### MODEL_CHANGE
Changes actual building semantics.

### DOCUMENTATION_CHANGE
Changes drawing presentation without changing building semantics.

### PRESENTATION_CHANGE
Changes visualization only.

### CANVAS_CHANGE
Changes exploratory artifacts only and never mutates authoritative building state.

### PROMOTION_CHANGE
Proposes conversion of selected exploratory artifacts into authoritative semantic objects.

---

## Canvas-to-Building promotion contract

A promotion request records:
- selected artifact ids
- intended target scope
- design locks
- semantic mapping
- inferred parameters
- confidence by field
- source lineage
- unresolved ambiguities
- proposed canonical operations

Promotion must fail or require review when:
- critical dimensions are missing
- geometry is ambiguous
- rule provenance is missing
- locked domains would be modified
- unsupported geometry cannot be represented safely

---

## Collaboration model

Permissions are capability-based:
- view
- comment
- create canvas artifact
- propose authoritative change
- approve discipline
- approve final
- issue documents
- manage company rules

Comments/markup can live in Canvas without automatically becoming model edits.

---

## Canonical units

Initial internal canonical units:
- length: millimetres
- area: square millimetres internally
- volume: cubic millimetres internally
- angle: radians internally
- currency: ISO currency + decimal

Every import records source unit and conversion.

---

## Coordinate model

Each project defines:
- ARCHON project origin
- north
- project datum
- survey transform
- per-adapter transforms

No adapter default origin is implicitly canonical.

---

## Early implementation recommendation

Start as a modular monolith.

Suggested logical packages:

```text
apps/web
packages/domain
packages/db
packages/canvas
packages/promotion
packages/validation
packages/adapters
packages/ai
packages/knowledge
packages/ui
packages/shared
```

Desktop/native adapters can later run as separate processes without rewriting core domain logic.
