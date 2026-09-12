# E8 scoped seed ingestion

POST /api/integrations/autocad/seed is disabled by default. It requires a short-lived bearer
capability whose SHA256, expected file SHA256/byte size, run ID, expiry and enable flag are
configured server-side. The capability is specific to one immutable seed payload, not a user login
or general storage permission. No credential or capability is committed to git or returned in JSON.

Unauthorized requests are refused before reading body bytes or calling Autodesk. Authorized bodies
must be application/octet-stream with the exact configured content length, bounded to 64 MiB.
A process-local lease prevents concurrent/replayed attempts. Failed attempts require explicit inspection,
not an automatic retry. The final payload digest and supported DWG header must match before OAuth.
The underlying upload targets the application's already-verified transient OSS bucket, refuses an
existing run key, signs 5 MiB parts, PUTs each without APS bearer headers, then completes the upload.
OSS metadata size and SHA1 must match original bytes. The result includes local SHA256 and header.
This proves transport integrity, not native DWG readability, drawing units, xrefs or font availability.

The route never executes AutoCAD, calls workitems, mutates Building Graph or creates/approves
production ChangeSets. The original client file is not modified or committed to the repository.
Disable ingestion and expire/revoke the capability immediately after a verified upload.
The bucket is short-lived testing storage, not a durable approved graph or document archive.

Server variables: ARCHON_SEED_UPLOAD_ENABLED, ARCHON_SEED_UPLOAD_TOKEN_SHA256,
ARCHON_SEED_SHA256, ARCHON_SEED_BYTES, ARCHON_SEED_RUN_ID, ARCHON_SEED_UPLOAD_EXPIRES_AT
(epoch milliseconds, at most about 30 minutes ahead).

## Validation checklist

- [x] Five local tests cover disabled/expired/unauthorized/misconfigured requests, payload digest,
  multipart sizes/token isolation, lease replay, ownership/existing-key/part failure and metadata integrity.
- [x] Public/default state fails closed; no workitem or production ChangeSet side effects.
- [x] 64 MiB seed limit is separate from the 16 MiB generated layout/report artifact limits.
- [ ] Application, Windows plugin and Linux worker CI pass before merge.
- [ ] Railway web and worker succeed after merge.
- [ ] Original seed bytes stored with matching size/SHA1/SHA256; ingestion disabled afterward.
- [ ] Native seed open, dependency diagnostics, output DWG reopen and geometry reconciliation pending.

Official OSS multipart reference:
https://aps.autodesk.com/blog/direct-s3-nodejs-samples
