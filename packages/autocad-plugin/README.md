# ARCHON AutoCAD plugin
Targets AutoCAD 2026 / Autodesk.AutoCAD+25_1 using Autodesk AutoCAD.NET 25.1.0 and .NET 8.
ARCHONLAYOUT reads fixed sandbox-local archon-input.json and creates a separate empty database.
The seed drawing opened by Automation Core Console is not modified.
Creates site/wall polylines, room DBText and native RotatedDimension entities in mm.
Entities carry ARCHON XData source ID, revision and source version.
The JSON report reads created database objects (not a blind echo) and includes native dimensions,
handles, source metadata and SHA256 of input bytes. Failed runs delete partial output artifacts.
It is input validation and downstream drawing generation only: never ARCHON approval.

CI generates the fixture from the TypeScript serializer, validates the pure C# contract,
compiles against official SDK references and packages the DLL + manifest in a verified ZIP.
CI does not load AutoCAD or execute a DWG job; native runtime behavior remains unverified.

prepare-activity.mjs takes the actual Automation namespace and writes a resource plan locally.
The output values become valid only after resources are created, the ZIP uploaded and aliases verified.
This script never requests tokens, calls APIs, creates resources or submits workitems.
The version:1 alias plans assume a new resource and must be reviewed against existing resources.

The activity requires a seed DWG, input JSON and output storage URLs. There is no workitem template
with real URLs or any automatic execution path in this checkpoint. Adapter submission remains blocked.
Native load/dimension/readback and reopening saved DWG must be tested in the next explicit sandbox test.
The plugin report is evidence for proposed reconciliation, never authority to mutate Building Graph.


Resource provisioning: provision-resources.mjs defaults to offline dry-run, requires a trusted bundle digest, and uses explicit --apply for new resources only. See docs/22_E8_APS_RESOURCE_PROVISIONING.md. No workitems are submitted.
