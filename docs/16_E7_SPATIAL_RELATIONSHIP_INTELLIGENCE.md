# E7.5 Spatial Relationship Intelligence

E7.5 refines the AI Design Engine before external CAD integration begins.

## Added intelligence

- calculates key planar distances between kitchen, service, dining and outdoor zones from canonical positions
- reads existing Building Graph relationship metadata as ranking context
- derives a compactness score from program-center distances
- incorporates proximity penalties and relationship bonuses into alternative scoring
- exposes spatial metrics directly in Layout Studio
- adds relationship-preservation constraints and rationale to each governed alternative

## Governance

The relationship-aware engine still produces only proposed ChangeSet operations. It does not directly mutate approved canonical state. The E7.4 preview/diff, validation, review, approval and immutable-version boundaries remain mandatory.

## E8 readiness

E7 is considered ready for the first external CAD adapter foundation once E7.4 and E7.5 are green in CI and deployed. E8.1 can then introduce a vendor adapter skeleton without bypassing ARCHON canonical ownership or approval governance.
