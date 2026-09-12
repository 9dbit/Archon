# E8 APS resource provisioning checkpoint

The standalone Node CLI defaults to offline dry-run. It is not exposed as a public web endpoint.
It verifies the ZIP signature/size and the supplied SHA256 against the compiled CI artifact.
It does not fully inspect ZIP contents: use only the bundle produced by package_bundle.py and a trusted CI digest.

Usage (Node 22+, from a trusted environment holding APS credentials):

```
node packages/autocad-plugin/provision-resources.mjs ACTUAL_NAMESPACE PATH_TO_ZIP TRUSTED_SHA256
```

Add `--apply` to provision resources. APS_CLIENT_ID and APS_CLIENT_SECRET stay in the local process.
The CLI authenticates, reads /forgeapps/me and requires its nickname to match ACTUAL_NAMESPACE.
It probes Autodesk.AutoCAD+25_1 and requires both local resource alias endpoints to return 404.
It creates a new AppBundle, posts the ZIP to Autodesk-issued S3 multipart upload parameters,
creates an alias bound to the returned version, then creates the activity and verifies its alias
and resolved activity engine, bundle reference and command line.
Returned versions are used instead of assuming version 1. Existing resources are never overwritten.
Output is a non-secret archon-aps-provisioning-result.json with the verified Railway configuration.
The file must not already exist. Archive/remove a previous local result before starting a new run.

Failures stop immediately. A partial resource may remain; there is no automatic retry, update,
delete or rollback. Inspect the account's resource state before another apply attempt.
Never copy OAuth responses, signed upload parameters or credentials into git or chat.
No workitem endpoint is implemented. Resource readiness is not approval or native DWG validation.

## Validation checklist

- [x] Offline dry-run has no network calls or credential requirement.
- [x] Digest mismatch fails before OAuth; namespace mismatch fails before resource writes.
- [x] Existing resources fail closed; no PATCH/PUT/DELETE or alias overwrite.
- [x] Actual returned versions are used; activity readback verifies engine/bundle/command.
- [x] APS bearer token is not forwarded to S3 or included in result JSON.
- [x] Upload/alias failures stop before activity creation in mock tests.
- [x] No Building Graph access or mutation; no production ChangeSet creation/approval.
- [x] Geometric/dimension/material/design rules are not changed by resource provisioning.
- [ ] Run provisioning in an environment with credentials and the trusted compiled bundle.
- [ ] Prepare seed DWG and scoped signed storage URLs for input/output.
- [ ] Review the concrete sandbox workitem and validation checklist before execution.
- [ ] Native DWG generation, reopen/readback and reconciliation remain unverified.

Official API reference: https://aps.autodesk.com/en/docs/design-automation/v3/reference/http/appbundles-POST/
Official upload tutorial: https://aps.autodesk.com/en/docs/design-automation/v3/tutorials/appbundles/task3-uploadappbundle/
