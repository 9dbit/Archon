# E8.1 AutoCAD Adapter Foundation

ARCHON now replaces the AutoCAD mock entry with a fail-closed Autodesk APS adapter foundation.

## Scope

- `AutoCadApsAdapter` implements the existing `ArchonEngineAdapter` contract.
- Adapter status is derived from `APS_CLIENT_ID`, `APS_CLIENT_SECRET`, and `APS_CALLBACK_URL`.
- Missing credentials return `OFFLINE` and block execution.
- Present credentials return `DEGRADED` until E8.2 proves a real APS OAuth and Automation API handshake.
- `/api/integrations/autocad/status` exposes non-secret readiness metadata.
- Integrations workspace shows capabilities, health, credential readiness, and the next required action.

## Governance

External CAD remains downstream of ARCHON canonical state. The adapter cannot silently mutate approved Building Graph data. Preview/execution results must later reconcile through governed ChangeSets and immutable versions.

## E8.2 gate

The next step requires real Autodesk APS application credentials. After credentials are configured in the deployment environment, E8.2 will:

1. request and validate an APS access token,
2. probe Automation API availability,
3. identify/prepare an AutoCAD engine + activity path,
4. run a non-destructive handshake before any DWG job is accepted,
5. keep execution fail-closed if any capability check fails.

No secret values belong in Git.
