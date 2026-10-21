# ARCHON Revit APS: isolated, execution-disabled pilot

This package is independent from `packages/autocad-plugin`. Its purpose is to
prove APS authentication and engine discovery before any billable native Revit
job is considered. Production Railway services are not configured here.

## Current verification

`node packages/revit-aps/check.mjs` verifies dedicated Revit credentials by
OAuth v2 and GET Automation engines. The October 21 2026 test on SPARK returned
`VERIFIED`, including `Autodesk.Revit+2026`; no tokens or secrets are committed.

## Worker

`node packages/revit-aps/worker.mjs` uses `ARCHON_REVIT_APS_WORKER_MODE=OFFLINE`
by default; it makes no outbound requests and serves read-only `/health` and
`/status`. `ARCHON_REVIT_APS_WORKER_MODE=DISCOVER` calls only OAuth and GET engines
and requires **dedicated** `ARCHON_REVIT_APS_CLIENT_ID` and
`ARCHON_REVIT_APS_CLIENT_SECRET`. `ARCHON_REVIT_APS_WORKER_MODE=AUDIT`
performs an OAuth + GET-only inventory of the configured AppBundle/Activity
and alias. Both modes are read-only. The worker cannot provision resources
or submit jobs.

Offline worker container validation:

```sh
docker build -f packages/revit-aps/worker.Dockerfile -t archon-revit-inspect .
docker run --rm --network none -e ARCHON_REVIT_APS_WORKER_EXIT=1 archon-revit-inspect
```

## Revit 2026 add-in, native execution not yet verified

The `pilot` folder contains an `IExternalDBApplication` implementation,
`.addin` manifest, and version-bound `PackageContents.xml`. The handler uses
`DesignAutomationReadyEvent` and reads the Revit document's title and wall/level
counts, writing `archon-revit-report.json` in the sandbox. The report also includes
read-only wall line measurements, wall heights and level elevations for
independent four-wall 12 m × 20 m pilot validation (±1 mm tolerance).
It does **not**
modify, save, or upload the input RVT.

Windows CI compiles against Revit 2026/.NET 8 and packages a ZIP. Autodesk's
`DesignAutomationBridge.dll` must be **next to `Archon.Revit.Pilot.dll`** within
the bundle; the build copies it from the NuGet package, and the packager refuses
to run if it is missing. Native `RevitAPI.dll` is provided by Autodesk's cloud
Revit engine, not by ARCHON.

Generate a **local-only** resource plan with the Autodesk Automation namespace
and a sanitized VERIFIED discovery result:

```sh
node packages/revit-aps/prepare-pilot.mjs MY_APS_NICKNAME /path/to/safe-discovery.json
```

The resource plan is *not* authorization to deploy or submit a WorkItem.
It describes future `GET` input RVT and `PUT` JSON report parameters,
without signed URLs or customer data in source control. Separate review
is required before provisioning AppBundle/Activity or running a billable WorkItem.

## Read-only APS resource inventory

After configuring dedicated Revit APS credentials **locally or in an isolated
staging environment**, run:

```sh
node packages/revit-aps/audit-check.mjs
```

This obtains one OAuth token and reads only Autodesk
`GET /forgeapps/me` plus `GET /appbundles/{id}/aliases/{alias}` and
`GET /activities/{id}/aliases/{alias}` for `$LATEST` and `pilot_v1`.
It classifies missing resources, missing aliases, invalid nicknames and
authorization errors. It **never registers, updates, deletes or submits**
AppBundles, Activities, aliases or WorkItems; an empty resource inventory is
not permission to create them. OAuth credentials and bearer tokens must
not be pasted into GitHub, logs, tickets, or chat.

APS nicknames are limited to **20 ASCII letters/numbers/underscores**,
whereas AppBundle and Activity names are limited to 40 characters. The
offline resource plan now applies the stricter nickname validation.

## Offline tests

```sh
node --test packages/revit-aps/*.test.mjs
python3 -m unittest discover -s packages/revit-aps/pilot -p 'test_*.py'
```

References: Autodesk official Revit add-in and Automation documentation.
