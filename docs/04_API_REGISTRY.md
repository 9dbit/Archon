# ARCHON API Registry v0.1

This registry is a planning source. Verify vendor versions, licensing and authentication requirements before enabling an integration in production.

## P0 — Foundation / MVP

### OpenAI
Purpose:
- architectural intent interpretation
- structured command generation
- agent reasoning/orchestration
- voice interaction
- embeddings/knowledge retrieval

Official docs:
- API overview: https://developers.openai.com/api/docs
- Responses API: https://developers.openai.com/api/docs/guides/migrate-to-responses
- Realtime API: https://developers.openai.com/api/docs/guides/realtime
- Embeddings: https://developers.openai.com/api/docs/guides/embeddings

Rule: model output never directly mutates critical canonical state. It creates typed proposals/ChangeSets validated by deterministic domain logic.

### ARCHON internal API
Purpose:
- web application to backend
- adapter authentication
- ChangeSet transport
- adapter health
- event delivery

Initial methods:
- HTTPS REST for commands/resources
- WebSocket for live adapter/project events

This API is owned by ARCHON and defined in the repository.

### PostgreSQL
Purpose:
- projects
- canonical objects
- relationships
- ChangeSets
- versions
- validation results
- approvals
- audit history
- adapter mappings

Use Replit-managed PostgreSQL for the first hosted environment if appropriate.

---

## P1 — SketchUp Proof of Concept

### SketchUp Ruby API
Purpose:
- active model access
- selection
- entity/component manipulation
- materials
- metadata/attributes
- observers
- operations/undo integration

Official:
https://ruby.sketchup.com/

Developer portal:
https://developer.sketchup.com/

Integration pattern:
ARCHON SketchUp Extension runs inside SketchUp and connects outbound to ARCHON API.

### SketchUp LayOut Ruby API
Purpose:
- MVP sheet/layout automation where suitable

Official:
https://ruby.sketchup.com/file.LayOut.html

### SketchUp Desktop SDK
Purpose:
- SKP file processing where supported outside the interactive Ruby-extension flow

Official developer portal:
https://developer.sketchup.com/

---

## P1/P2 — Autodesk BIM / Documentation

### Revit API
Purpose:
- BIM element creation/update
- levels/grids
- walls/doors/windows/floors/rooms
- parameters/families
- views/sheets/schedules
- BIM-side validation

Official:
https://aps.autodesk.com/developer/overview/revit-api

### Autodesk Platform Services OAuth
Purpose:
- Autodesk cloud authentication/authorization

Official:
https://aps.autodesk.com/en/docs/oauth/v2

### APS Automation API
Purpose:
- cloud/batch Revit and AutoCAD processing
- document generation
- data extraction
- parameter modifications

Official:
https://aps.autodesk.com/en/docs/design-automation/v3

### APS AEC Data Model API
Purpose:
- query granular AEC model data where supported
- analytics and validation

Official:
https://aps.autodesk.com/developer/overview/aec-data-model-api

### APS Data Management API
Purpose:
- Autodesk-hosted project/file/version access

Official:
https://aps.autodesk.com/en/docs/data/v2

### APS Model Derivative API
Purpose:
- translate design files into web-viewable/derived formats

Official:
https://aps.autodesk.com/en/docs/model-derivative/v2

### APS Viewer SDK
Purpose:
- web 2D/3D model viewing and interaction where Autodesk-derived model viewing is selected

Official:
https://aps.autodesk.com/en/docs/viewer/v7

### AutoCAD APIs
Purpose:
- DWG interoperability
- legacy detail workflows
- annotation/document automation

Official overview:
https://aps.autodesk.com/developer/overview/autocad-api

Cloud automation:
https://aps.autodesk.com/en/docs/design-automation/v3

---

## P2 — Render / Parametric Geometry

### V-Ray Application SDK
Purpose:
- rendering orchestration
- cameras/lights/material scene control
- render jobs

Official:
https://docs.chaos.com/vray_app_sdk/

### Rhino.Compute
Purpose:
- Rhino geometry computation
- Grasshopper/parametric workflows
- advanced facade/organic geometry/optimization

Official:
https://developer.rhino3d.com/guides/compute/compute-faq/

---

## Open interoperability

### IFC / buildingSMART
Purpose:
- vendor-neutral BIM exchange/fallback
- external application interoperability

Official:
https://technical.buildingsmart.org/standards/ifc/

IFC is an interchange layer, not the ARCHON canonical database.

---

## Adapter policy

Every external integration must implement an ARCHON capability declaration and as many of these operations as applicable:

```text
connect
healthCheck
capabilities
pullChanges
preview
validate
pushChangeSet
reconcile
rollback
export
```

No adapter may silently write approved canonical data.

## Credential policy

Never commit secret values to Git.

Expected environment variable names may include:

```text
OPENAI_API_KEY
DATABASE_URL
ARCHON_PUBLIC_URL
ARCHON_WS_URL
APS_CLIENT_ID
APS_CLIENT_SECRET
APS_CALLBACK_URL
RHINO_COMPUTE_URL
RHINO_COMPUTE_KEY
```

Only add credentials when that integration is actually enabled.
