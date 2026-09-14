# E8 Command Prompt Center target review and CAD command samples

This checkpoint extends the Command Prompt Center sandbox MVP with operator target review. Ambiguous commands such as `Move wall 500 mm` now surface canonical Building Graph candidates in the UI. Selecting a candidate reruns the read-only preview with that exact `targetArchonId`, producing a governed Proposed ChangeSet payload only after the target is explicit.

The command bank in Layout and Drawings now includes early CAD editing samples for the planned AutoCAD roundtrip:
- move a named wall by 500 mm
- move an ambiguous wall after target selection
- resize kitchen width
- set kitchen depth
- generate a DWG preview layer plan
- issue a Bahasa Indonesia wall-edit command

Governance remains unchanged. The preview endpoint is read-only, proposal creation still goes through the existing `changesets/propose` route, active ChangeSets block new proposal creation, and APS/DWG execution remains locked until explicit operator approval and validator activation are complete.
