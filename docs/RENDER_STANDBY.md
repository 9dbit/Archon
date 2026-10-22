# ARCHON standby on Render (October 2026)

Deploy the `deploy/archon-render-standby-20261022` branch of
`https://github.com/9dbit/Archon` to Render as an independent standby.

## Safety and scope

- Railway production remains unchanged, stays the primary host, and keeps its own database and Autodesk credentials.
- Render uses separate PostgreSQL, separate web compute, and (later) an isolated read-only APS worker.
- The initial Render database is **empty except for applied schema migrations**. Do not describe this as a production data backup or hot failover until a controlled, verified backup/restore/replication plan has been completed.
- This branch adds `Dockerfile.render`, `apps/web/middleware.ts` and `/api/render-health`.
- Set `ARCHON_RENDER_STANDBY_READ_ONLY=true`. All HTTP mutations return 423. Do not disable it until access controls, synchronization and a failover procedure have been reviewed.
- Set every ARCHON sandbox execution, setup, approval issuance, seed upload and finalization enable flag to `false`.
- Do **not** reuse the Railway AutoCAD OAuth client or APS tokens in Render.
- Do not redirect any customer domain or modify Cloudflare DNS yet.

## Render web service

- Repo: `https://github.com/9dbit/Archon`
- Branch: `deploy/archon-render-standby-20261022`
- Runtime: Docker
- Dockerfile: `./Dockerfile.render`
- Build context: repository root
- Region: Singapore, consistent with UNO Luck and Pentagon
- Build: Dockerfile uses pinned Node 22 and pnpm 10.17.1
- Startup: idempotent Drizzle migrations before Next.js server starts
- Port: `PORT=10000`
- Readiness: `GET /api/render-health` verifies database connectivity; `GET /api/health` verifies web process
- Autodeploy disabled until the initial standby is fully verified.

## Database

Use a separate Render PostgreSQL instance (not a Railway production URL).
Keep database credentials only in Render environment variables, never GitHub.
Connect `DATABASE_URL` privately. Migrations are safe to rerun and are
applied at startup only to the independent Render database.

## Rollout gates

1. Verify GitHub branch CI and Docker build.
2. Verify Render PostgreSQL is available, with migrations applied.
3. Verify Render deploy reaches LIVE and `/api/render-health` returns 200.
4. Verify GET browsing works; POST mutation returns 423 in standby mode.
5. Verify worker remains OFFLINE with all APS mutation/execution modes disabled.
6. Later: secure and verify data restoration/replication from Railway, and
   prepare an explicit active/passive failover procedure.
7. Only after a final controlled failover test may DNS or customer traffic move.

No automatic traffic switching, data migration, or WorkItem submission is
part of initial deployment. Never infer resilience from a green /health alone.
