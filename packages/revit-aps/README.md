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

```
docker build -f packages/revit-aps/worker.Dockerfile -t archon-revit-inspect .
docker run --rm --network none -e ARCHON_REVIT_APS_WORKER_EXIT=1 archon-revit-inspect
```

## Revit 2026 add-in, source only until native CI and later pilot

The `pilot` folder contains a native `IExternalDBApplication` implementation,
`.addin` manifest, and version-bound `PackageContents.xml`. The handler uses
`DesignAutomationReadyEvent` and reads only the Revit document metadata and
wall/level counts, writing `archon-revit-report.json` in the sandbox. It does
**not** modify, save, or upload the input RVT. On an error it does not mark the
Automation event successful. The add-in has not been run inside Revit yet.

The manifest targets `Autodesk.Revit+2026`, with .NET 8 and version-bound
Autodesk NuGet package references. A Windows CI runner compiles and packages
an AppBundle ZIP; CI does not upload that ZIP to Autodesk.

To generate a **local-only** resource plan, obtain your APS app nickname from
the Autodesk developer account, and provide a sanitized VERIFIED discovery JSON:

```
node packages/revit-aps/prepare-pilot.mjs MY_APS_NICKNAME /path/to/safe-discovery.json
```

The resource plan is *not* an authorization to deploy or submit a WorkItem.
It describes a possible future `GET` input RVT and `PUT` JSON report. There are
no signed URLs or customer-model data in source control. A separate explicit
review is required before provisioning any AppBundle/Activity or running a
potentially billable WorkItem. Never paste secrets in chat or git.

## Tests

```
node --test packages/revit-aps/*.test.mjs
```

Sources: Autodesk APS official Revit add-in and Automation examples; their
Revit bundle requires a `.addin` DBApplication manifest, not AutoCAD's DLL-only
PackageContents format.
