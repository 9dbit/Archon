# E8 scoped production ledger activation and APS spec probe

`POST /api/integrations/autocad/sandbox/setup` is disabled by default. A server-configured setup flag, hashed temporary bearer token and expiry of at most thirty-one minutes are required. Only ACTIVATE_LEDGER and PROBE_RESOURCES are accepted; submission and arbitrary request fields are rejected. Responses omit tokens, database URLs, signed URLs and provider bodies.

ACTIVATE_LEDGER uses a PostgreSQL transaction and advisory lock to apply only the additive sandbox ledger DDL. It checks exact columns/types/nullability, run primary key, provider ID uniqueness and lifecycle constraint evidence. Unexpected existing schema rolls back. It records migration 0002 only if the existing migration tracking table exists; foundation and canonical geometry migrations are not replayed. The normal migration DDL is now idempotent for subsequent migration runs.

PROBE_RESOURCES authenticates the actual APS namespace, verifies configured owned resource IDs, both version-one aliases, bundle/activity engines, command line, four required get/put arguments and script. This performs OAuth and GET requests only, never workitem submission or resource mutation. Resource metadata validation is not a fresh digest of bundle ZIP bytes; that remains explicitly pending, as do seed/input readback, output absence/fresh capabilities and explicit job approval.

Local tests cover operator disable/expiry/authorization, rejected job operations, diagnostic redaction and changed APS specs/config/versions. Real disposable PostgreSQL CI additionally covers repeat activation, unchanged unrelated data and rollback of malformed schema. CI must pass before merge, then Railway must deploy successfully. Enable scoped setup only long enough for reviewed operations; revoke token and disable it immediately afterward, and verify the closure deployment.

No canonical graph mutation, production ChangeSet approval, output DWG or APS job is produced. Native geometry/dimensions and material/design rules remain pending actual approved execution.

Official APS resource read reference: https://aps.autodesk.com/en/docs/design-automation/v3/reference/http/appbundles-id-GET
