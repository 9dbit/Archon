# E8 validator Activity provisioning and reopen-report finalization

ARCHON now has a guarded provisioning path for the native AutoCAD validator activity, `ArchonValidateDrawing+v0_1`. The helper creates only the validator Activity and alias, reusing the already provisioned `ArchonLayoutBundle+v0_1`; it refuses namespace mismatches, existing validator activities, alias mismatches and readback differences. Dry-run mode performs no network call. Apply mode performs APS OAuth, read-only preflight, Activity creation and alias verification only; it never submits a workitem.

The APS worker can now run `DISCOVER_VALIDATOR` or `APPLY_VALIDATOR`, but production remains fail-closed unless the operator deliberately changes worker mode and supplies reviewed configuration. The Railway variable emitted by a successful apply is non-secret: `APS_VALIDATOR_ACTIVITY_ID`.

Validator reopen-report finalization is now restart-safe. `POST /api/integrations/autocad/sandbox/validator/finalize` has its own temporary bearer gate and is disabled by default. When enabled, it requires a submitted validator ledger row, claims the encrypted validator receipt, completes the report upload, downloads the reopen report, validates it against the current pinned source version, stores immutable `NATIVE_REOPEN_VERIFIED` evidence and consumes the receipt.

The finalizer never treats APS success as ARCHON approval. A pending APS validator workitem returns `reconciliation: "NONE"` without claiming the receipt. Ambiguous report retrieval, receipt decryption or evidence storage marks the validator receipt `UNKNOWN` when possible and does not retry automatically.

No real APS validator workitem is executed by this checkpoint, and no approved Building Graph or production ChangeSet is mutated.
