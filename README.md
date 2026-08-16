# ARCHON

**The AI Operating System for Architecture**

ARCHON is an AI-first architecture platform intended to connect design intent, parametric building data, SketchUp, BIM/Revit, CAD documentation, rendering, materials, validation, BOQ/cost, and project operations through a single canonical project model.

## Core principle

ARCHON is the source of architectural intent and project truth. External design tools are adapters, not independent masters.

Every authoritative change must follow:

`Intent → Proposed ChangeSet → Sandbox → Validation → Checklist → Review/Edit → Approval → Commit → Sync → Reconciliation`

## Current status

Phase 0 foundation + smallest Project Genesis slice is implemented: governed ChangeSet pipeline (propose → validate → review/edit → approve → immutable version → audit), deterministic brief interpreter, mock CAD adapters, REST API, and a mission-control web UI.

## Repository layout

```
lib/domain            Pure domain logic (zod types, state machine, validation gate, interpreter, AI router)
lib/db                Drizzle ORM schema + migrations (PostgreSQL, 10 tables)
lib/engine            Transactional pipeline (change sets, projects, canvas promotion, seed)
artifacts/api-server  Express 5 REST API (port 3001)
artifacts/archon-web  React + Vite web UI (proxies /api to the API server)
docs/                 Authoritative architecture and product documents
```

## Running on Replit

Both workflows are preconfigured and start automatically:

- **ARCHON API** — `pnpm --filter @workspace/api-server run dev` (port 3001)
- **artifacts/archon-web: web** — `pnpm --filter @workspace/archon-web run dev` (the preview pane)

The built-in PostgreSQL database is provisioned via `DATABASE_URL`.

## Running locally

Prerequisites: Node 20+, pnpm 9+, PostgreSQL 16.

```bash
pnpm install

# Point at your database
export DATABASE_URL=postgres://user:pass@localhost:5432/archon

# Apply schema (runs lib/db/src/migrate.ts against DATABASE_URL)
pnpm run db:migrate

# Optional: seed the "Restaurant Demo" project through the real pipeline
pnpm run db:seed

# Start the API (port 3001) and the web UI in separate terminals
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/archon-web run dev
```

The web dev server proxies `/api/*` to `http://localhost:3001`.

## Quality gates

```bash
pnpm run lint          # prettier --check (fix with: pnpm run format)
pnpm -r run typecheck  # tsc across all packages
pnpm -r run test       # 20 domain unit tests + 14 API integration tests

# Browser E2E (requires both dev servers running; Playwright chromium via
# `pnpm --filter @workspace/archon-web exec playwright install chromium`,
# or set PW_CHROMIUM_PATH to a system Chromium on NixOS hosts)
pnpm --filter @workspace/archon-web run test:e2e
```

The API integration tests require `DATABASE_URL` and fail loudly (never skip) if it is missing. CI configuration lives in `.github/workflows/ci.yml` (lint, typecheck, migrate, and tests against a Postgres 16 service container).

## API overview

Base URL `/api`:

- `POST /projects`, `GET /projects`, `GET /projects/:id` — projects with approved snapshot
- `POST /projects/:id/interpret-brief` — deterministic brief interpretation, body `{ text }` (never persists)
- `POST /projects/:id/change-sets`, `GET /projects/:id/change-sets` — propose/list ChangeSets (`{ intentSummary, operations, affectedDomains?, source?, createdBy? }`)
- `GET /change-sets/:id` — ChangeSet with its validation checks
- `GET /change-sets/:id/preview` — sandboxed before/after snapshot preview
- `PATCH /change-sets/:id` — edit operations (`{ operations, intentSummary?, affectedDomains?, actor? }`); returns state to PROPOSED
- `POST /change-sets/:id/validate` — run the Validation Gate (`{ actor? }`)
- `PATCH /change-sets/:id/checks/:checkId` — annotate a check (`{ reviewerNote?, waiverReason?, actor? }`)
- `POST /change-sets/:id/approve`, `POST /change-sets/:id/reject` — review decisions (`{ reviewer?, note? }`); approval commits atomically
- `GET /projects/:id/versions`, `GET /projects/:id/audit-events` — immutable history
- `GET/POST /projects/:id/canvas-artifacts`, `POST /canvas-artifacts/:id/promote` — non-authoritative canvas
- `GET /adapters`, `POST /adapters/:id/simulate` — mock CAD adapters (`{ projectId, mode: "sync" | "failure" }`)
