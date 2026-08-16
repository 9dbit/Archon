# ARCHON — GitHub ↔ Replit Sync Protocol

## Objective
Use GitHub as the persistent source of code, review history, approvals and handoff between ChatGPT and Replit. Replit is the active implementation environment.

## Why this model
Replit supports importing GitHub repositories and full Git synchronization (pull, push, branches, conflict resolution). This lets ARCHON continue without a direct ChatGPT↔Replit connector.

## Responsibility map

### GitHub
Authoritative for:
- source code history
- branches and pull requests
- architecture documents
- issues/blockers
- review comments
- approved merges

### Replit
Responsible for:
- implementation with Replit Agent
- runtime preview
- local development environment
- database/runtime configuration
- tests and debugging
- pushing tested code back to GitHub

### ChatGPT
Responsible for:
- product/architecture planning
- GitHub review
- issue/PR triage
- updating product specifications
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
4. Commit only coherent tested changes.
5. Push branch to GitHub.

### GitHub as message bus
Replit communicates with ChatGPT through GitHub artifacts:
- Code changes: branch commits
- Ready for review: draft PR
- Blocker: GitHub issue or PR comment
- Important assumption: PR description
- Architecture decision: documentation/ADR
- Test results: PR description / CI logs

ChatGPT can then inspect those GitHub changes without needing direct access to the Replit workspace.

## Merge policy
- Replit must never merge its own implementation into `main`.
- Implementation PRs default to Draft until validation evidence is complete.
- A PR may be considered ready only when:
  - required tests pass
  - validation/approval semantics match docs
  - no critical architecture rule is bypassed
  - no secrets are committed
  - known limitations are documented
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

## Automatic checks
After the application scaffold exists, add GitHub Actions for:
- dependency install
- lint
- typecheck
- unit tests
- selected integration tests

Do not add a speculative CI workflow before the actual package manager and commands exist. The first Replit implementation PR should add CI using the real project scripts.

## Phase 0 handoff prompt
In Replit Agent Plan mode, use the repository master prompt from `docs/05_REPLIT_MASTER_PROMPT.md`, with this additional instruction:

> Treat GitHub as the source-of-code truth and follow `replit.md` plus `docs/10_REPLIT_GITHUB_SYNC.md`. Work on `agent/replit-phase-0-foundation`, push tested checkpoints to GitHub, and open a draft PR when the milestone is ready. Do not merge to main.

## Phase 0 handoff completion signal
The Replit milestone is considered handed back to ChatGPT when a draft PR exists on GitHub containing:
- implementation summary
- architecture decisions
- tests run/results
- known limitations
- screenshots/preview notes if useful
- explicit next milestone recommendation

At that point ChatGPT reviews the PR directly through GitHub and returns requested changes through the PR/issue workflow.