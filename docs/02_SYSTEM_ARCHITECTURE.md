# ARCHON System Architecture v0.1

## Architectural thesis

ARCHON synchronizes meaning, identity, constraints and approved changes. It does not synchronize files directly between authoring applications.

```text
User / Voice / Markup
        |
        v
ARCHON Intent Layer
        |
        v
Proposed ChangeSet
        |
        v
Canonical Building Graph
        |
        +--> Rules / Knowledge / Materials
        |
        v
Validation Gate
        |
        v
Review / Edit / Approval
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
       Derived asset graph
    drawings / BOQ / render
```

## Core bounded contexts

### 1. Identity Service
Creates immutable ARCHON IDs and external application mappings.

Example:

```json
{
  "archonId": "window_01JX...",
  "type": "window",
  "externalMappings": {
    "sketchup": "persistent-id-or-archon-attribute",
    "revit": "element-id-mapping",
    "autocad": "block-guid"
  }
}
```

### 2. Canonical Building Graph
Stores semantic project state independently from any authoring vendor.

Objects contain:
- identity
- object type
- parameters
- relationships
- constraints
- source/provenance
- revision
- confidence where AI-derived

### 3. ChangeSet Engine
No critical mutation directly edits approved state.

ChangeSet states:

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

### 4. Validation Engine
Runs deterministic and evidence-backed checks before approval.

### 5. Approval Engine
Supports project-stage and discipline-specific approvals.

### 6. Dependency Graph
Tracks which objects and derived assets depend on changed objects.

### 7. Adapter Gateway
Provides a common contract for external software integrations.

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

Adapters may implement only the capabilities their host software supports.

### 8. Orchestrator
Coordinates multi-adapter updates using a saga-style workflow rather than pretending all external applications share one atomic transaction.

### 9. Reconciliation Engine
Compares canonical expected state to adapter-reported state and detects stale, missing, conflicting or simplified representations.

### 10. Reliability Layer
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

---

## Authority model

ARCHON must distinguish semantic authority from representation fidelity.

| Domain | Default authority |
|---|---|
| ARCHON IDs | ARCHON |
| Design intent | ARCHON |
| Rules/constraints | ARCHON |
| Material specification | ARCHON |
| Version/audit | ARCHON |
| High-fidelity BIM representation | Revit adapter |
| Conceptual geometry representation | SketchUp adapter |
| CAD annotation/layout | AutoCAD adapter |
| Render pixels | Render engine |

External changes are proposals until reconciled, validated and approved into ARCHON.

---

## Change classes

### MODEL_CHANGE
Changes actual building/project semantics.

Examples:
- move wall
- resize window
- replace material specification
- add door

Must propagate to dependency graph.

### DOCUMENTATION_CHANGE
Changes drawing presentation without changing the building.

Examples:
- move dimension text
- adjust annotation location

Must not alter canonical building geometry.

### PRESENTATION_CHANGE
Changes visualization only.

Examples:
- exposure
- render glossiness override
- camera

Must not alter construction truth unless explicitly promoted to a material/design change.

---

## Canonical units

Initial internal canonical units:
- length: millimetres
- area: square millimetres internally, display conversion allowed
- volume: cubic millimetres internally, display conversion allowed
- angle: radians internally with explicit display conversion
- currency: ISO currency code + decimal value

Every imported value records source unit and conversion.

---

## Coordinate model

Each project defines:
- ARCHON project origin
- north
- project datum
- survey transform
- per-adapter transforms

No adapter's default origin is implicitly treated as canonical.

---

## Persistence recommendation for early Replit build

Start as a modular monolith, not microservices.

Suggested logical packages:

```text
apps/web
packages/domain
packages/db
packages/validation
packages/adapters
packages/ai
packages/ui
packages/shared
```

The adapter contract remains process-independent so adapters can later move to desktop agents/services without rewriting domain logic.
