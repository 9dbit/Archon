# E7 Brief-Aware Constraint Model

## Purpose
ARCHON Design Engine must not generate geometry in a vacuum. E7.2 introduces a read-only constraint layer that combines the Project Brief with the approved canonical Building Graph before ranking design alternatives.

## Inputs
The constraint model reads `project_briefs` fields:
- site width/depth
- target GFA
- levels and floor-to-floor heights
- program requirements
- setbacks
- notes

The first supported program requirement keys are intentionally tolerant so imported briefs can evolve without a migration:
- target seats: `targetSeats`, `seats`, `seatTarget`, `capacity`
- minimum circulation: `minCirculationMm`, `circulationMm`, `minimumAisleMm`
- kitchen share: `kitchenSharePct`, `kitchenPercent`, `bohKitchenPct`

Fallbacks are explicit and conservative: 1000 mm circulation, 18% kitchen share, one level.

## Governance boundary
The brief is advisory input to generation and scoring. It cannot mutate the Building Graph. A selected alternative still goes through the existing governed flow:

`Brief + Canonical Graph -> Alternatives -> Select -> Proposed ChangeSet -> Validation -> Review -> Approval -> Immutable Version`

## E7.2 scoring
The current deterministic engine adjusts Capacity, Circulation, Operations and Cost scores using target seats, circulation baseline and inferred kitchen share from canonical geometry. Site area, target GFA and levels are surfaced as constraints/evidence.

This is a foundation slice, not a final code-compliance engine. Constraint values must later be promoted into the formal validation pipeline with source provenance and jurisdiction-specific rule references.

## Safety rules
- no automatic approval
- no direct mutation of approved canonical objects
- one active ChangeSet remains enforced
- missing brief fields never fabricate project-specific facts; documented defaults are shown as defaults
- generated geometry remains bounded by the proposal API limits
