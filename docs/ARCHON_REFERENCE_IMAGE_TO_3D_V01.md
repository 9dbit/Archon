# ARCHON Reference Image to 3D, V0.1 (Guarded Sandbox)

## Scope and current state

Implemented on feature/reference-image-to-3d-20261024 as an isolated SketchUp concept-plan preview.
The endpoint accepts a local JPEG/PNG/WebP image and explicit width/depth (3-50m each).
It calls the OpenAI Responses API with a strict structured output schema and store:false,
then validates and returns a conceptual, reviewed JSON massing plan.
**The main ARCHON executor remains read-only.** An optional standalone ARCHON Concept Sandbox RBZ can generate grouped, editable SketchUp massing **only in a blank, unsaved model, with explicit confirmation**. It cannot update an existing model or auto-save an .skp. Revit and production editing are not part of this slice.

## Privacy and security

- POST /api/integrations/sketchup/reference-image/preview
- Existing SketchUp bearer credential verified against ARCHON_SKETCHUP_BRIDGE_TOKEN_SHA256.
- Endpoint OFF by default. Explicitly set ARCHON_REFERENCE_VISION_ENABLED=true in a secure staging environment.
- Configure OPENAI_API_KEY and an image-capable ARCHON_REFERENCE_VISION_MODEL.
- Images are never persisted on ARCHON; they are sent to OpenAI for processing.
- Strict input and payload size caps; supported image signatures checked.
- MAX 2 in-flight requests per server instance; no automatic provider retries.
- Implement durable account-based quotas, device-scoped credentials and audit controls before wider access.
- NEVER expose the bearer credential or API key in client-side browser JavaScript.
- The output is an approximation from a single perspective; it is not BIM or construction documentation.

## Request example

POST /api/integrations/sketchup/reference-image/preview
Authorization: Bearer <sketchup-bridge-token>
Content-Type: application/json

JSON:
  {
    "image": {"mimeType":"image/jpeg","base64":"<base64-no-prefix>"},
    "dimensions":{"widthM":12,"depthM":16},
    "projectName":"Concept Villa"
  }

Response fields: schema, state=REVIEW_REQUIRED, plan, assumptionsNotMeasured, review and execution.
execution.mode=PREVIEW_ONLY; execution.sketchUpMutationEnabled=false.

## Deployment boundary

The existing ARCHON Railway production service tracks main. Do not merge until tests, preview review and explicit approval.
The ARCHON Revit UI Staging service tracks a different feature branch and must not be repointed.
Deploy the new feature branch to an isolated staging service only when needed, with VISION_ENABLED=false initially.
The existing Ruby executor's APPROVE_SKETCHUP_EXECUTOR gate stays hard locked. The standalone sandbox uses a completely separate local extension and accepts only empty, unsaved SketchUp models. It never modifies an existing project file.

## Hardware safety

TRADEVICEPC hosts MetaTrader 5. No installer, reboot, SketchUp command or trading process action is part of this work.
SketchUp 2026 installation and verification will occur after the user confirms it is ready.

## Roadmap

1. Offline contract + TypeScript tests (this slice).
2. Authenticated cloud preview endpoint (this slice).
3. SketchUp extension image picker, dimensional input, JSON export (this slice).
4. Isolated staging health/security tests and optional provider test with explicit API key.
5. Optional ARCHON Concept Sandbox RBZ generator: guarded blank-model create from reviewed JSON (code and CI only).
6. Manual in-app SketchUp 2026 smoke test; compare generated editable massing with reference and manually save an .skp.
7. Governed, versioned change sets for existing models remain a separate future approval gate.
8. Iterative visual quality checks and 3D refinement.
