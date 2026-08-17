# ARCHON UI Screenshot Protocol v1

## Purpose

Screenshots are a required review artifact for every checkpoint that creates or changes visible UI. The goal is to let Replit Agent, ChatGPT, and human reviewers compare what the application actually looks like against the intended ARCHON UX before deciding the next implementation step.

GitHub remains the persistent visual history.

## Folder standard

All screenshot evidence lives under the repository root folder:

```text
screenshot/
  README.md
  <update-id>/
    manifest.json
    REVIEW.md
    desktop/
      <route-slug>.png
    mobile/
      <route-slug>.png
```

Use singular folder name `screenshot` exactly.

### Update ID

One update folder represents one reviewable UI checkpoint, not every tiny code commit.

Format:

```text
YYYYMMDD-HHMM_<checkpoint>_<short-sha>
```

Example:

```text
screenshot/20260817-1030_checkpoint-a_3fa9c21/
```

If the Git SHA is not known before capture, use a temporary folder name during generation and rename it before the evidence commit.

## What must be captured

For every navigable application route in the current milestone:

1. Desktop full-page screenshot.
2. Mobile full-page screenshot.

Default viewports:

```text
Desktop: 1440 x 1000
Mobile: 390 x 844
```

Use deterministic seed/demo data so visual comparisons are meaningful between updates.

For routes with important alternate states, also capture state variants when applicable:

- empty
- populated
- loading if materially relevant
- validation warning
- validation blocker
- successful approval/commit
- error/failure state

State filenames should be explicit, for example:

```text
desktop/project-workspace--blocker.png
desktop/project-workspace--approved.png
```

## Route naming

Convert routes to stable slugs.

Examples:

```text
/                         -> dashboard.png
/projects/new             -> projects-new.png
/projects/demo            -> project-workspace.png
/projects/demo/validation -> project-validation.png
```

Dynamic identifiers should use deterministic seeded aliases such as `demo`, not random UUIDs in filenames.

## Capture method

Use Playwright for automated capture. The screenshot process should:

1. Start or connect to the local Replit preview server.
2. Wait for the route to reach a stable ready state.
3. Disable animations/transitions where possible for deterministic output.
4. Capture full-page PNG screenshots.
5. Fail loudly if a required route cannot render.
6. Never silently skip a route.

The project should expose a dedicated script once the application scaffold supports it, for example a `screenshot` or `ui:evidence` script. The exact command may follow the actual package-manager structure chosen by Replit.

## manifest.json

Every update folder must include machine-readable metadata with at least:

```json
{
  "updateId": "20260817-1030_checkpoint-a_3fa9c21",
  "checkpoint": "A",
  "commitSha": "3fa9c21",
  "branch": "agent/replit-phase-0-foundation",
  "capturedAt": "2026-08-17T10:30:00+07:00",
  "baseUrl": "local-preview",
  "viewports": {
    "desktop": { "width": 1440, "height": 1000 },
    "mobile": { "width": 390, "height": 844 }
  },
  "routes": [
    {
      "route": "/",
      "slug": "dashboard",
      "desktop": "desktop/dashboard.png",
      "mobile": "mobile/dashboard.png",
      "status": "captured"
    }
  ]
}
```

Do not put secrets, private URLs with tokens, production credentials, or customer data in the manifest.

## REVIEW.md

Every update folder must also contain a short human-readable review note:

```text
# UI Review - Checkpoint A

## What changed
- ...

## Routes captured
- ...

## Visual issues observed by Replit Agent
- ...

## Known intentional placeholders
- ...

## Questions / decisions needed
- ...

## Recommended next UI step
- ...
```

Replit Agent should inspect its own screenshots before pushing and record obvious UI problems instead of merely generating images.

## screenshot/README.md

Maintain an index of visual checkpoints, newest first.

Each entry should include:

- update ID
- checkpoint / feature
- commit SHA
- date
- link to the update folder
- one-line description

This file is the entry point for ChatGPT visual review.

## Git and PR workflow

For any UI-affecting checkpoint:

```text
implement
-> lint/typecheck/tests
-> run UI screenshot capture
-> inspect screenshots
-> fix obvious regressions if needed
-> rerun capture if UI changed
-> commit implementation + evidence
-> push branch
-> reference screenshot folder in PR/checkpoint note
```

A UI-affecting checkpoint is not considered complete if screenshots are stale relative to the code being reviewed.

The `manifest.json` commit SHA must correspond to the implementation state being visually reviewed. An evidence-only follow-up commit is acceptable if it changes only the screenshot artifacts and metadata.

## ChatGPT review criteria

When reviewing a checkpoint from GitHub, evaluate screenshots for:

- hierarchy and readability
- consistency with `docs/08_UI_WORKSPACE_SPEC.md`
- Canvas vs Building authority clarity
- validation visibility and severity states
- approval affordance clarity
- architecture-specific terminology
- density vs calmness
- spacing/alignment
- desktop/mobile responsiveness
- stale or contradictory UI states
- whether placeholders are clearly labeled

Visual review does not replace domain tests. Screenshots are evidence for presentation and interaction state, while automated tests remain evidence for logic and data integrity.

## Repository size discipline

Screenshots can grow the Git repository quickly. Therefore:

- Capture per reviewable checkpoint, not per small commit.
- Keep only required routes/states.
- Prefer full-page PNG but avoid duplicated captures with no meaningful visual difference.
- Do not capture videos in this folder.
- If repository size becomes material, future phases may move historical evidence to GitHub Actions artifacts or external object storage while retaining a lightweight visual index in GitHub.

Until that migration is intentionally approved, GitHub screenshot history remains the default.

## Privacy and safety

Never capture:

- secrets panels
- environment variables
- access tokens
- OAuth codes
- personal email/account screens
- production customer information
- unrelated browser tabs or desktop chrome

Capture only the ARCHON application viewport using Playwright, not operating-system screenshots.

## Phase 0 minimum route evidence

Once those routes exist, Phase 0 should at minimum capture:

```text
/
/projects/new
/projects/<seed-demo-id>
```

And capture the project workspace in important states such as:

```text
brief / baseline
pending ChangeSet
validation warning/blocker
approved new version
integrations/mock health
```

The actual route list must be read from the implementation rather than hard-coded to this preliminary list.
