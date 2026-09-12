# E8 seed readback verification

The multipart seed endpoint previously required OSS metadata SHA-1 to equal the local checksum and reported a live integrity mismatch after finalization. Metadata alone cannot establish the actual stored bytes.

Every seed now requires a complete, bounded signed-S3 download and exact SHA-256 comparison against the checksum-bound source bytes. Size, bucket ownership, signed URL host, token separation and disabled execution checks remain. Provider SHA-1 agreement is reported as true/false/null; acceptance requires independent SHA-256 readback in every case. A metadata discrepancy is visible and never substitutes for byte verification.

Scoped `ARCHON_SEED_VERIFY_ONLY=true` performs read-only verification of the existing run's seed, without signing uploads, PUT, overwrite or finalization. Missing existing objects fail closed. The route still requires the temporary token, exact source body, checksum, size and run scope. This recovery mode avoids uploading another OSS copy after a post-finalization failure.

Validation: tests cover missing/discrepant metadata, corrupted readback, existing-only mode without cloud writes, absent object, multipart boundaries, authorization, ownership and replay. Geometric/dimensional/material/design checks are pending native execution and review; no graph mutation or approval occurs here.
