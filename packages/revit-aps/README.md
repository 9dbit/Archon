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
`ARCHON_REVIT_APS_CLIENT_SECRET`. It cannot provision resources or submit jobs.

Offline worker container validation:

```sh
docker build -f packages/revit-aps/worker.Dockerfile -t archon-revit-inspect .
docker run --rm --network none -e ARCHON_REVIT_APS_WORKER_EXIT=1 archon-revit-inspect
```

## Revit 2026 add-in, native execution not yet verified

The `pilot` folder contains an `IExternalDBApplication` implementation,
`.addin` manifest, and version-bound `PackageContents.xml`. The handler uses
`DesignAutomationReadyEvent` and reads the Revit document's title and wall/level
counts, writing `archon-revit-report.json` in the sandbox. It does **not**
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

## Offline tests

```sh
node --test packages/revit-aps/*.test.mjs
python3 -m unittest discover -s packages/revit-aps/pilot -p 'test_*.py'
```

References: Autodesk official Revit add-in and Automation documentation.
