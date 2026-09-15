# E8 AutoCAD Viewer UI foundation

The Drawings workspace now includes a fail-closed AutoCAD Viewer review stage. It is a UI and diagnostics foundation for the Autodesk Platform Services Viewer SDK, not a claim that an external DWG is already translated or loaded.

## Behavior

- `DWG Review` shows viewer readiness, translation state and diagnostics.
- The panel exposes no APS token, signed URL or secret.
- Missing `ARCHON_AUTOCAD_VIEWER_ENABLED`, `APS_VIEWER_URN`, or successful `APS_VIEWER_TRANSLATION_STATUS` keeps the stage locked.
- `PENDING` translation is shown separately from configuration failure.
- External sync and execution remain locked; the Building Graph is unchanged.
- The future Viewer session endpoint can load a verified derivative into the stage without changing the Command Center governance route.

## Configuration contract

The status route reads only these non-secret deployment values:

- `ARCHON_AUTOCAD_VIEWER_ENABLED=true`
- `APS_VIEWER_URN=<verified translated derivative urn>`
- `APS_VIEWER_TRANSLATION_STATUS=SUCCESS`

These values are intentionally not added to production in this checkpoint. A real URN must be issued by APS after a specific DWG object has been uploaded and translated. The next transport slice must issue a short-lived Viewer token server-side and bind it to the immutable artifact receipt.

## Responsive shell

At intermediate desktop widths, the main grid now reduces panel minima and contains overflow so the inspector does not push the document beyond the viewport. The top toolbar remains horizontally scrollable when its full locked navigation cannot fit.

## Governance

The Viewer is read-only. It is an external artifact review surface, never the canonical source of truth. No ChangeSet is created or approved by this checkpoint, and no AutoCAD Automation job is submitted.
