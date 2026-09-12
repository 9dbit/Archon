# E8.2 live connection discovery
The Railway Node server starts one read-only APS connection probe per process.
Only credentials are required: OAuth v2 token followed by GET engines (bounded pagination),
GET appbundles and GET activities. Configured resource IDs additionally trigger the existing
read-only resource handshake. Discovery reports actual AutoCAD engine IDs and first-page
resource counts with a partial-count flag. It never selects an engine or changes variables.
Provider tokens and raw error bodies stay private; snapshots contain only sanitized metadata.
Public status GET is pure, uncached and does not cause provider requests.
Integrations displays OAuth and AutoCAD access separately and polls snapshots every 15 seconds.
A successful probe never enables execution or approves anything.

## Validation checklist
- Geometry, dimensions, materials, principles and rules: no canonical state changes.
- Approval and immutable versions: no production ChangeSet creation or approval.
- External resources: no appbundle/activity creation and no workitem submission.
- Security: one startup probe per process, bounded requests, sanitized responses, no new public control endpoint.
- UI: assistant/viewport/inspector and toolbar layout preserved.
- Tests: credential-only discovery, pagination cap, malformed responses, denied Automation access, one-time startup and token privacy.
- Required checks: full CI before merge and Railway deployment afterward.

## Remaining work
Compiled AutoCAD plugin, appbundle upload/alias, activity definition, geometry serializer,
DWG transport and reconciliation are still separate governed work. Resource IDs shown as missing
are not an instruction to invent values. Use only IDs returned from Autodesk or created resources.
