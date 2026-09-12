# E8.2 APS OAuth and Automation handshake foundation
Server-only client-credentials OAuth v2 with code:all, bounded requests, redirect rejection,
validated token responses, single-flight cache, expiry margin and invalidation.
Callback configuration is retained for future three-legged user OAuth; it is not needed by app-only Automation.
An explicit server-side handshake reads the configured engine, activity and appbundle and checks their association.
It never creates resources or submits a workitem. No public token or handshake endpoint is exposed.
Public status is non-secret, uncached, and explicitly NOT_PROBED. Successful handshake does not mark execution ready.

## DWG pipeline skeleton
A version-bound PREVIEW or APPROVED_VERSION plan specifies millimetres and site/wall/room/dimension layers.
It is a plan only: no geometry serializer, compiled AutoCAD plugin, signed storage URLs, DWG generation,
artifact verification or reconciliation implementation exists yet.
submitWorkItem always rejects. AutoCAD preview now returns FAILED instead of incorrectly implying a queued remote job.
No production ChangeSet is created/approved. No canonical object or approved version is changed.

## Required user configuration
Configure APS_CLIENT_ID and APS_CLIENT_SECRET privately in Railway.
Prepare an AutoCAD Automation engine, uploaded/compiled appbundle and associated activity with aliases.
Set APS_AUTOCAD_ENGINE, APS_ACTIVITY_ID and APS_APPBUNDLE_ID to those resource identifiers.
APS_CALLBACK_URL remains optional for future user OAuth; app-only readiness does not require it.
Do not put secrets in GitHub, browser responses or chat.
After configuration, an explicitly invoked read-only handshake can verify access.
Real execution still requires the next governed transport implementation and explicit test authorization.

## Validation checklist
- Geometry/dimensions/materials: no Building Graph mutation; future plan uses mm and defined layers.
- Design/rules: existing validation/approval/version boundaries preserved.
- Adapter approval: successful auth/resources still leave execution disabled.
- Security: tests reject missing/malformed auth, conceal provider error bodies, enforce GET-only resource probes.
- UI: locked workspace unchanged.
- CI: new mocked-network tests plus existing full typecheck/build.
- Deployment: verify Railway after merge.

## Primary references
https://aps.autodesk.com/blog/migration-guide-oauth2-v1-v2
https://github.com/autodesk-platform-services/aps-design-automation-nodejs
