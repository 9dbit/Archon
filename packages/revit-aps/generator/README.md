# ARCHON Revit 2026 native generator (draft only)

This package compiles a separate Revit 2026 `IExternalDBApplication` that **would**
produce a real `pilot.rvt` and `pilot-report.json` in an Autodesk Automation
sandbox. It **has not run inside Revit and no RVT has been produced**.

The draft does not call Autodesk APIs, register AppBundles or Activities,
submit WorkItems, access customer models, or deploy to Railway production.
Keep it in a separate GitHub draft branch until a valid seed and staging
credentials are available.

## Fixed pilot contract

Provide a legitimate Revit **2026** project seed with no walls, zero to two
levels (only 0 and 3500 mm elevations), and at least one basic wall type.
Do not use client data. Supply the accompanying tiny JSON input:

```json
{
  "schemaVersion": 1,
  "widthMm": 12000,
  "lengthMm": 20000,
  "wallHeightMm": 3500,
  "upperLevelMm": 3500
}
```

The generator rejects unexpected JSON properties, oversized input,
different dimensions, nonempty wall geometry, family documents, workshared
models, unexpected levels, and preexisting output files. It executes one
Revit transaction, creates exactly four native `Wall` elements on ground
level and two `Level` elements at 0 and +3500 mm, saves `pilot.rvt`,
and emits a report containing SHA-256, element IDs and measured elevations.
It sets `independentlyReopened=false`; reopening with a **separate**
read-only WorkItem remains mandatory. A compiled DLL is not proof that
Autodesk successfully ran the generator.

### Local/offline tests (safe without Autodesk credentials)

```sh
node --test packages/revit-aps/generator/*.test.mjs
python3 -m unittest discover -s packages/revit-aps/generator -p 'test_*.py'
```

Windows CI compiles the Revit 2026 API add-in and packages the
`DesignAutomationBridge.dll` next to the generator DLL. RevitAPI.dll
must be provided by Autodesk's Revit engine, not by this package.

### Unapplied resource-plan preview

```sh
node packages/revit-aps/generator/prepare-generator-plan.mjs \
  MY_APS_NICKNAME /path/to/sanitized-discovery.json
```

This writes an offline proposal with `Autodesk.Revit+2026`, a separate
AppBundle/Activity, input `GET` for RVT and JSON and output `PUT`
for RVT and report. The plan includes single concurrency, no retries and
`executionEnabled=false`. It does **not** authorize paid execution.
