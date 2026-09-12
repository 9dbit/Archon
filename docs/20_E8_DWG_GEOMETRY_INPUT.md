# E8 DWG geometry input checkpoint
Pure version-bound serialization for site rectangles, axis-aligned walls, room labels and dimensions.
Coordinates map ARCHON X/Z ground-plane to CAD X/Y. All values remain mm.
Every entity carries the source object ID and revision. Input is copied and never modifies canonical state.
Preview source requires a ChangeSet reference. That reference and APPROVED_VERSION mode are descriptive,
not approval authority. Freshness and approval must be checked independently before execution.

Invalid/nonfinite coordinates, nonpositive sizes, explicit transforms, mismatched levels,
duplicate source IDs and geometry outside the site fail closed. Unsupported object IDs are disclosed.
Dimensions are derived from geometry. Materials/circulation/topology/production compliance are not
validated by this serializer, and the checklist explicitly warns about those boundaries.

Tests cover 500 mm moves, kitchen resizing, mapping, identities, copying, scope warnings and rejection.
This checkpoint adds no public execution endpoint, creates no production ChangeSet,
uploads no appbundle/activity and sends no workitem. Locked UI remains unchanged.
Compiled plugin, activity configuration, storage transport, real DWG verification and reconciliation
remain pending; successful serialization is not successful DWG generation.

## Validation gate
- Geometry/dimensions: finite coordinates, positive sizes, bounds, coordinate mapping and measured values tested.
- Material/design/rules: approved graph unchanged; unsupported checks disclosed.
- Governance: execution disabled; proposed-only reconciliation boundary.
- CI: APS tests, DWG input tests, full typecheck and web build before merge.
- Railway: verify matching merged commit deployment afterward.
