# E8 encrypted validator receipt and governed endpoint orchestration

The native DWG reopen validator now has a restart-safe submission boundary. `POST /api/integrations/autocad/sandbox/validator` remains disabled by default behind the existing temporary endpoint gate, and the concrete APS transport remains separately disabled by `ARCHON_SANDBOX_VALIDATOR_TRANSPORT_ENABLED`. Enabling the endpoint alone still cannot execute a validator job.

When both reviewed operator gates are open, the server rebuilds the pinned sandbox review, requires previously stored `ARTIFACTS_VALIDATED` evidence, verifies the configured `APS_VALIDATOR_ACTIVITY_ID` for `ArchonValidateDrawing+v0_1`, prepares fresh private S3 capabilities, durably claims `archon_sandbox_validator_submissions`, stores an AES-GCM encrypted validator receipt, and only then permits exactly one APS validator workitem submission. A restart or ambiguous failure after `SUBMITTING` leaves the run locked or `UNKNOWN`; automatic retry is not allowed.

The encrypted validator receipt stores only the minimum reopen-report capability needed for later finalization. Its authenticated data binds the run ID, manifest digest and artifact-evidence digest. It does not expose signed URLs, upload keys, provider tokens, DWG bytes or secrets in endpoint responses.

The validator workitem envelope is exact: `inputDwg` is a read-only `get` argument and `reopenReport` is a `put` argument. The provider submitter rejects any other activity ID, argument set, verb or non-S3 signed URL before OAuth or network submission.

This checkpoint does not inspect validator completion, ingest the reopen report or grant ARCHON approval. Native reopen evidence remains a review-only second stage (`NATIVE_REOPEN_VERIFIED`) and can only propose ChangeSets later. No approved Building Graph mutation, production ChangeSet approval or real APS job is performed by this code path while the gates are closed.
