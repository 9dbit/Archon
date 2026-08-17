# ARCHON - GitHub <-> Replit Sync Protocol

## Objective
Use GitHub as the persistent source of code, review history, approvals, visual evidence and handoff between ChatGPT and Replit. Replit is the active implementation environment.

## Why this model
Replit supports importing GitHub repositories and full Git synchronization (pull, push, branches, conflict resolution). This lets ARCHON continue without a direct ChatGPT-to-Replit connector.

## Responsibility map

### GitHub
Authoritative for:
- source code history
- branches and pull requests
- architecture documents
- issues/blockers
- review comments
- approved merges
- persistent UI screenshot evidence

### Replit
Responsible for:
- implementation with Replit Agent
- runtime preview
- local development environment
- database/runtime configuration
- tests and debugging
- automated UI screenshot capture
- pushing tested code and screenshot evidence back to GitHub

### ChatGPT
Responsible for:
- product/architecture planning
- GitHub review
- issue/PR triage
- updating product specifications
- reviewing committed UI screenshots
- deciding whether implementation matches ARCHON contracts
- preparing next implementation prompts

## One-time setup in Replit
1. Import `https://github.com/9dbit/Archon` using Replit GitHub import.
2. If the project was created separately, connect its Git tool to `9dbit/Archon` as the remote repository instead of maintaining two independent histories.
3. Confirm Replit can see the repository's `main` branch.
4. Confirm root `replit.md` exists after sync. Replit Agent should automatically use it as project context.
5. Open Replit Agent in Plan mode.
6. Ask Agent to read `replit.md` and the referenced ARCHON documents before coding.

## Development session protocol

### Start
1. Fetch/pull latest GitHub state.
2. Confirm no unrelated local changes are present.
3. Start from current `main`.
4. Create/switch to milestone branch, initially:
   `agent/replit-phase-0-foundation`
5. Ask Agent to produce/confirm the milestone plan before modifying code.

### During implementation
Build in small checkpoints:
- Foundation/bootstrap
- Domain + persistence
- ChangeSet/validation/approval/versioning
- Project Genesis
- mock adapter/reliability
- UI polish only after domain correctness

At each checkpoint:
1. Run relevant tests.
2. Run lint/typecheck.
3. Inspect diff.
4. If the checkpoint creates or changes visible UI, run the screenshot evidence workflow from `docs/11_UI_SCREENSHOT_PROTOCOL.md`.
5. Inspect generated screenshots for obvious regressions.
6. Commit only coherent tested changes and their current visual evidence.
7. Push branch to GitHub.

### GitHub as message bus
Replit communicates with ChatGPT through GitHub artifacts:
- Code changes: branch commits
- Ready for review: draft PR
- Blocker: GitHub issue or PR comment
- Important assumption: PR description
- Architecture decision: documentation/ADR
- Test results: PR description / CI logs
- UI result: `screenshot/<update-id>/` and `screenshot/README.md`

ChatGPT can then inspect GitHub changes and visual evidence without needing direct access to the Replit workspace.

## UI screenshot handoff

Every UI-affecting checkpoint must create a visual checkpoint under:

```text
screenshot/<update-id>/
```

Each update contains:
- `manifest.json`
- `REVIEW.md`
- desktop screenshots for every route in scope
- mobile screenshots for every route in scope

The PR or checkpoint note must identify the exact screenshot folder to review.

Do not use screenshots as a replacement for tests. Screenshot evidence proves visible UI state; automated tests prove logic and data integrity.

See `docs/11_UI_SCREENSHOT_PROTOCOL.md` for the full standard.

## Merge policy
- Replit must never merge its own implementation into `main`.
- Implementation PRs default to Draft until validation evidence is complete.
- A PR may be considered ready only when:
  - required tests pass
  - validation/approval semantics match docs
  - no critical architecture rule is bypassed
  - no secrets are committed
  - known limitations are documented
  - UI-affecting changes have current screenshot evidence
- Merge is handled after GitHub review.

## Conflict policy
When Replit detects upstream changes:
1. Do not overwrite them silently.
2. Fetch latest `main`.
3. Rebase/merge into the working branch using the least destructive method.
4. If architectural meaning conflicts, stop implementation and record the conflict in GitHub.
5. Never resolve a source-of-truth or validation conflict merely to make code compile.

## Secrets
GitHub stores no live secret values.
Replit Secrets holds runtime credentials.
Only variable names/documentation may be committed, e.g. `.env.example` later.

Screenshots must never capture secrets, OAuth codes, Replit Secrets panels, account pages, personal email, or production customer data.

## Automatic checks
After the application scaffold exists, add GitHub Actions for:
- dependency install
- lint
- typecheck
- unit tests
- selected integration tests

Do not add a speculative CI workflow before the actual package manager and commands exist. The first Replit implementation PR should add CI using the real project scripts.

The local/Replit checkpoint workflow should additionally automate route screenshot capture through Playwright once the web application is runnable.

## Phase 0 handoff prompt
In Replit Agent Plan mode, use the repository master prompt from `docs/05_REPLIT_MASTER_PROMPT.md`, with this additional instruction:

> Treat GitHub as the source-of-code truth and follow `replit.md` plus `docs/10_REPLIT_GITHUB_SYNC.md`. Work on `agent/replit-phase-0-foundation`, push tested checkpoints and current screenshot evidence to GitHub, and open a draft PR when the milestone is ready. Do not merge to main.

## Phase 0 handoff completion signal
The Replit milestone is considered handed back to ChatGPT when a draft PR exists on GitHub containing:
- implementation summary
- architecture decisions
- tests run/results
- known limitations
- exact screenshot update folder(s)
- visual review notes
- explicit next milestone recommendation

At that point ChatGPT reviews the PR and committed screenshots directly through GitHub and returns requested changes through the PR/issue workflow.
