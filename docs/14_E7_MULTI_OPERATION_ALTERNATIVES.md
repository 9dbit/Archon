# E7 Slice 3 · Coordinated Multi-Operation Design Alternatives

## Goal
Move the AI Design Engine from single-object geometry suggestions to coordinated design proposals that can adjust several canonical objects together while preserving ARCHON governance.

## Flow
`Project Brief + Building Graph -> Design Alternative -> Operation Batch -> Proposed ChangeSet -> Validation -> Review -> Approval -> Immutable Version`

## Rules
- A generated alternative may contain multiple canonical `MOVE` or `UPDATE` operations.
- Selecting an alternative creates one ChangeSet containing the entire operation batch.
- The batch is atomic from the user's review perspective: it is reviewed, edited, discarded, rebased and approved as one design intent.
- The proposal API normalizes every operation and caps a proposal at 12 operations.
- Each operation must target an existing canonical object before the ChangeSet can be created.
- Existing dimension and movement safety limits continue to apply to every operation independently.
- AI alternatives never mutate the approved Building Graph directly.
- No automatic approval is introduced by this slice.

## Initial strategies
- **Capacity Forward** coordinates indoor dining, outdoor guest area and service support.
- **Operations Forward** coordinates kitchen, service and dining geometry.
- **Balanced Flow** distributes conservative changes across guest, BOH, service and outdoor zones.

## Current limitations
This slice coordinates dimension edits, but it is not yet a full constraint solver. Scores are heuristic and validation does not yet prove real circulation, adjacency, egress, structural or MEP compliance. Those remain downstream validation responsibilities.

## Next slice
Add a preview/diff surface for all operations in an alternative and all operations in an active ChangeSet, rather than showing only the first operation in 3D preview.
