# E8 sandbox job review contract

`createSandboxManifest` binds the fixed synthetic seven-entity fixture SHA-256, descriptive test-only PREVIEW source, verified seed bytes/path, resource namespace and version 1 aliases, engine, bundle digest, run ID and output object paths. Its SHA-256 covers all these review fields. Output serialization whitelists metadata and excludes supplied OAuth tokens or signed URLs.

This contract is not an executable APS payload and is not authorization. It performs no network requests, submission, graph mutation or approval. Seed/resource evidence is supplied by a trusted server caller; the pure function does not attest that evidence independently. Changing fixture bytes, production source, traversal paths, missing seed verification or unpinned resource versions fails closed.

Before asking for execution approval: implement a durable one-attempt submission ledger and trusted execution boundary, verify live resource versions/bundle digest and existing seed again, prepare/verify input storage, check output absence, and resolve fresh private transport capabilities. The review hash does not bind ephemeral secret URL query strings; the future server must bind their exact resource and verb to this contract. A digest supplied by an external engine does not grant ARCHON approval.

Geometry/dimensions are scoped to the fixed fixture. Project material, construction, circulation and design compliance remain outside this transport test. Native seed open, saved-DWG reopening and artifact reconciliation remain pending actual approved execution. No execution approval is requested by this checkpoint.
