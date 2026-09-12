# E8 DWG output transport and sandbox review draft

Output reservations use an application-owned transient OSS bucket and unique run keys.
Both output object keys must be absent before any signing call. Each file uses a single-part
signed S3 PUT URL; URLs and upload keys are held in an in-memory closure, never JSON status.
JSON serialization returns only a redacted summary. Capability use is blocked after nine minutes
within the ten-minute provider lifetime. Fresh capabilities must be generated immediately before a job.
No workitem submission is implemented or authorized by reserving outputs.

A future server caller binds the actual workitem ID and independently reads its APS success status.
Finalization requires that bound ID, success, and the prepared source version still current.
A supplied status string is descriptive evidence, not a trustworthy approval or verification boundary.
After success, the session completes each multipart upload, retrieves bounded output bytes,
checks the AC1032 signature, and checks JSON report against the exact prepared input SHA256,
source metadata, entity indices/handles, identities/revisions/layers, coordinates and dimensions.
Failure stops without retries or rollback; one output may already have been finalized.
A signature is not proof of a valid DWG. Report comparison is not saved-DWG reopen/readback.

Even matching artifacts remain ARTIFACTS_REQUIRE_ARCHON_REVIEW. approvalGranted=false,
nativeDwgReopenVerified=false, and reconciliation=PROPOSE_CHANGESET_ONLY.
No canonical graph changes, production ChangeSets or approvals are produced.

OUTPUT_PROBE worker mode only reserves signed output URLs and publishes a redacted summary.
It does not PUT bytes, finalize objects, fabricate DWGs, bind a job, or call workitems.
Probe capabilities are discarded; regenerate them when an actual reviewed test is ready.
Return the worker to DISCOVER after the probe.

## Concrete sandbox fixture review draft

Scope: isolated test-only fixture, with descriptive test project/version/preview references.
It does not use or approve a production Building Graph version.

| Element | Expected geometry in millimetres |
| --- | --- |
| Site boundary | X -5000 to 5000, Z -4000 to 4000; 10000 x 8000 |
| North wall | Centre X 0, Z -3900; 10000 x 200 plan rectangle |
| Kitchen label | Centre X 0, Z 0; text Kitchen |
| Kitchen dimensions | 4000 x 3000 |
| Entity count | 7: 2 polylines, 1 text, 4 native dimensions |
| Layers | ARCHON_SITE, ARCHON_WALLS, ARCHON_ROOMS, ARCHON_DIMS |
| Mapping | ARCHON X/Z to AutoCAD X/Y, mm |
| Output files | archon-output.dwg and archon-report.json |

This draft is not an executable or approved workitem. Pending inputs: seed DWG required by the
registered activity, trusted seed bytes/digest and storage key, fresh input/output URLs, exact
workitem manifest, explicit sandbox execution approval, and native saved-DWG validation.
The seed is opened by Core Console; the plugin generates a separate new database.
Do not run against a client's live drawing for this initial test.

## Validation checklist

- [x] Local tests cover secret-free reservation, ownership/existing-output guards,
  capability expiry, unrelated/failed job rejection, mock completion and report comparison.
- [x] Wrong DWG signature, stale source, changed report geometry/revision/index/digest fail closed.
- [x] Adapter success never grants ARCHON approval; native reopening remains pending.
- [x] Geometry/dimension checks are bounded to the prepared axis-aligned test fixture.
- [ ] Materials, circulation, construction principles and design-rule validation are outside this test.
- [ ] Three CI jobs pass before merge; Railway web/worker succeed after merge.
- [ ] Real output signing probe succeeds; no output bytes or DWG job generated.
- [ ] Seed DWG and complete manifest prepared before asking for sandbox approval.

Official upload/finalization reference:
https://aps.autodesk.com/blog/direct-s3-nodejs-samples
