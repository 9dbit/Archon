# E8 AutoCAD plugin and bundle checkpoint
Adds a .NET 8 AutoCAD 2026 plugin, APS bundle manifest, verified ZIP packaging,
resource configuration builder and a Windows CI job.
Uses Autodesk.AutoCAD+25_1 already returned by live engine discovery.
SDK pinned to the official Autodesk AutoCAD.NET 25.1.0 reference package.

## Validation checklist
- Geometry/dimensions: pure C# contract checks mm mapping, finite points, axis-aligned rectangles,
  entity/layer whitelist and native dimension definitions; test fixture comes from ARCHON serializer.
- Material/design/rules: Building Graph unchanged; plugin does not replace ARCHON validation.
- Approval/versioning: input source metadata is descriptive, report carries no approval authority.
- Isolation: new sandbox database, fixed output paths, refuses pre-existing outputs and removes partial failures.
- Identity: entity XData + report handles/source IDs/revisions/version and input fingerprint.
- CI: compile, contract validation, ZIP inspection plus existing APS/geometry/typecheck/build.
- UI: no UI changes.
- External execution: no resources uploaded/created, no workitem, no production ChangeSet creation/approval.
- Deployment: verify matching Railway merged commit.

## Remaining gates
Compilation/packaging does not prove native AutoCAD runtime compatibility.
Actual namespace/resource registration, appbundle upload + aliases, activity creation,
seed DWG and signed storage URLs remain pending. No credential values enter source/artifacts.
A real sandbox workitem requires separate explicit test authorization.
Reopen output DWG and verify dimensions, mapping, labels, metadata and geometric differences
before accepting the report as reconciliation evidence.

## Sources
https://www.nuget.org/packages/AutoCAD.NET/25.1.0
https://get-started.aps.autodesk.com/tutorials/design-automation/prepare-plugin/
https://get-started.aps.autodesk.com/tutorials/design-automation/define-activity/
