# E8 Command Center live reviewed diff

Command Prompt Center in Layout and Drawings now renders a local before/after geometry diff directly from `reviewedOperations`, the same state used by Create Proposed ChangeSet. Editing numeric values, changing MOVE/UPDATE or the canonical target, and Reset to preview recalculate the diff from canonical objects. Prior preview output is never used as the next baseline.

## Boundaries

- The shared ChangeSet preview panel has a `reviewed` variant with a separate `command-reviewed-preview` anchor. Existing ChangeSet bar navigation still targets `changeset-preview`.
- Reviewed previews display validation pending, not the active ChangeSet's findings. The parser checklist is explicitly separate from reviewed-operation validation.
- Invalid review input hides the numeric diff. Missing geometry, unknown targets, unsupported operations and nonfinite results are reported as unavailable, never fabricated.
- A zero delta is shown explicitly. Fractional millimeters are not rounded to whole millimeters.
- This is a tabular geometry diff, not a DWG render, AutoCAD reopen result, or code-compliance validation.
- The diff has no network or persistence effects. Approved Building Graph objects and operation payloads remain unchanged.
- Existing proposal, active ChangeSet and approval gates are unchanged. This checkpoint does not create or approve any production ChangeSet or submit APS/DWG work.

## Verification

The ARCHON CI verify job runs `node --experimental-transform-types --test apps/web/components/changeset-preview-geometry.test.mjs`. Tests cover edited values and reset, target switching, dimensions, ordered multi-operation composition, immutable input, unavailable geometry, nonfinite results, no-op/empty inputs, fractional units and JSX wiring to the actual reviewed submit payload.

The preview uses container-responsive columns and wraps long IDs and numeric values. Browser interaction and screenshot verification remain a separate check; the tests above do not claim browser coverage.
