# E8 isolated APS provisioning worker

The multi-stage image compiles the AutoCAD 2026 plugin with the .NET 8 SDK, packages only
ARCHON's DLL and manifest, and runs a Node 22 worker. It does not run AutoCAD natively.
SDK/Python are excluded from the runtime. Credentials are runtime variables only; no build args.

Modes:
- OFFLINE: verifies packaged bundle SHA256; no OAuth or provider calls.
- DISCOVER (default): obtains OAuth token, reads the application's namespace, verifies the bundle,
  and builds an offline resource plan. No resource mutation or workitem submission.
- APPLY: requires ARCHON_APS_EXPECTED_NAMESPACE to match the authenticated namespace and uses
  the new-resource-only provisioning CLI. Existing resources are never overwritten.

The worker runs once on process startup, then serves GET /health and /status snapshots.
There is no HTTP execution or provisioning trigger. Logs include only non-secret result data.
Failures log diagnostic codes and make /health return 503. The service has no automatic restart.
APPLY must be switched back to DISCOVER after a successful run; redeploying APPLY will fail
closed on the now-existing resources. Partial failure requires account inspection, never blind retry.
Only credential references to the existing archon-web service are configured; secrets need not be copied.
Do not generate a public domain for this administrative worker.

Deploy service configuration: packages/autocad-plugin/worker.railway.json.
The root railway.json remains the web application's config. Both service deployments must be verified.
Worker credential reference syntax: ${{archon-web.APS_CLIENT_ID}} and ${{archon-web.APS_CLIENT_SECRET}}.

## Validation checklist

- [ ] Linux container compile succeeds against Autodesk SDK; Windows plugin CI remains required.
- [ ] Runtime-image offline check and provisioning guard tests pass with networking disabled.
- [x] No AutoCAD native runtime or DWG job is invoked by the container.
- [x] No Building Graph/database dependency or production ChangeSet mutation.
- [x] Geometry, dimension, material and design rules are unchanged by infrastructure setup.
- [x] Resource registration stays separate from approval and workitem submission.
- [ ] Railway DISCOVER confirms the actual namespace and packaged bundle digest.
- [ ] Provision resources only after reviewing discovered namespace and bundle.
- [ ] Supply seed DWG and scoped storage URLs; review a concrete sandbox workitem.
- [ ] Native DWG reopen/readback and reconciliation remain pending.
