# E8 APS sandbox input storage

The worker's explicit STORAGE_PREPARE mode uses a separate OAuth token scoped to
bucket:create, bucket:read, data:read and data:write. Automation tokens are not reused.
It derives a sandbox bucket name from a SHA256 of the application ID, creates a transient
bucket only if absent, and reads ownership/policy back before any object upload.
It uploads the CI-generated test-only layout fixture to a fresh run-specific object key.
Existing keys are refused. The S3 flow signs one part, PUTs input bytes without APS bearer
headers, completes the upload with uploadKey, then downloads through a signed URL and
verifies the exact byte SHA256. Downloads are bounded to 16 MB.

No credentials, signed URLs, upload keys or provider response bodies enter logs or status.
The non-secret worker result records bucket, object key, size, input SHA256 and retention policy.
STORAGE_PREPARE runs once per process; switch back to DISCOVER after success to prevent
unnecessary fresh uploads on redeployment. Failures stop; no automatic retries, overwrite,
delete or rollback. Transient storage is for short-lived testing, not approved version archives.

The fixture contains test-only project/version/preview references. They are not database records,
proof of approval or permission to run a production ChangeSet. No workitem is submitted.
A seed DWG and output signed-upload/finalization lifecycle are still needed before a concrete
sandbox workitem can be reviewed. Input upload readiness is not full DWG pipeline readiness.

## Validation checklist

- [x] Four mock tests cover exact-byte round trip, ownership/existing-object guards,
  unsafe URL/failed PUT finalization guards and tampered download rejection.
- [x] Signed S3 requests omit APS OAuth headers; public results omit capability URLs and tokens.
- [x] No Building Graph mutation or production ChangeSet creation/approval.
- [x] Input geometry comes from the governed serializer's test-only fixture.
- [x] Dimensions derive from source millimetres; material/design/rule validation is not implied.
- [ ] ARCHON CI application, Windows plugin and Linux worker checks pass before merge.
- [ ] Real sandbox bucket/input round trip verified in Railway.
- [ ] Worker returned to discovery and web deployment verified.
- [ ] Seed DWG, output transport, explicit sandbox review, native execution and reconciliation pending.

Official references:
https://aps.autodesk.com/en/docs/oauth/v2/developers_guide/scopes/
https://aps.autodesk.com/en/docs/data/v2/reference/http/buckets-POST
https://aps.autodesk.com/blog/direct-s3-nodejs-samples
