# ARCHON: Railway primary -> Render standby, offsite backup stage

Status: **prepared only**, 22 October 2026. Scripts in `ops/backup/` are inert source files. There is **no scheduled export, object storage, restored dataset, or automatic failover** until the steps below are separately completed and verified. Render web/DB health checks alone are not data durability tests.

## Verified inventory (2026-10-22)

- Railway project `ARCHON` production has separate `archon-web`, `archon-aps-worker`, and PostgreSQL 18 services in `sfo`.
- Render has `archon-render-standby` Docker web and separate PostgreSQL 18 in Singapore. `/api/render-health` returned HTTP 200 and `database=connected` from TRADEVICEPC.
- Render rejects HTTP write attempts in standby (423 previously checked); do not disable `ARCHON_RENDER_STANDBY_READ_ONLY=true`.
- Both Postgres instances use private connectivity. Render Postgres has an empty public IP allowlist. **Do not open either database to the internet** just to transfer a snapshot.
- Railway's current project inventory shows no object-storage buckets and no backup exporter service. It does not establish whether native volume backups are already scheduled; inspect the Railway Postgres **Backups** page.

## Proposed recovery architecture

```text
Railway ARCHON PostgreSQL (primary, read-only pg_dump)
        |
        | Dedicated Railway cron/export worker (not web or APS)
        | pg_dump custom format -> age recipient-encrypted output
        v
External S3-compatible object store (AWS S3 / Cloudflare R2), versioning
        |
        | encrypted artifact + SHA-256 manifest
        v
Render disposable scratch PostgreSQL (manual restore verification)
        |
        | compare object counts, schema, critical rows, app behavior
        v
Render standby PostgreSQL (only after approved cutover procedure)
```

The external object store must be operationally independent of Railway so a Railway outage cannot strand the only export. Only a **public age recipient** is needed in Railway; the **secret age identity file** stays with the recovery operator / secured Render restore job. Neither belongs in GitHub, logs, chat or query parameters. Restrict S3 permissions, use TLS, set retention/versioning/object-lock as appropriate, and provision alerting for failed exports.

## Preflight gates (do not bypass)

1. Verify Railway native Postgres volume backup schedule and restore policy. These are a separate defense from offsite exports, not a Render replica.
2. Provision external S3-compatible bucket with least-privilege writer for Railway and read-only reader for recovery. Keep credentials in each platform's secret store, never repository variables.
3. Generate an **age X25519** keypair locally offline. Record the `age1...` public recipient as `BACKUP_AGE_RECIPIENT` on the exporter; store the private identity in secure recovery secret storage. Test decrypt from a harmless synthetic sample before exporting production data.
4. Create a separate least-privilege PostgreSQL source role with `CONNECT`, `USAGE`, `SELECT` access sufficient to dump the complete application DB. Verify roles, extensions and sequence access. Set a `DATABASE_URL` for that read-only role on a dedicated Railway export job, not the web service. The script additionally sets read-only transactions.
5. Set exporter-only `ARCHON_EXPECTED_DATABASE`, `S3_BUCKET`, optional `S3_ENDPOINT_URL` (HTTPS only), optional `S3_KEY_PREFIX`, `BACKUP_AGE_RECIPIENT`, and `ARCHON_BACKUP_ARMED=I_ACKNOWLEDGE_READ_ONLY_EXPORT`. The exporter refuses to run outside Railway project `cb0578cf-1bc9-4023-9657-e161ed814127` production. A suggested starting schedule after a manual pass is **hourly**; the real RPO remains up to the interval plus export lag.
6. Run a **single manual export** and capture only the resulting object key, byte size, SHA-256, duration and status. `ops/backup/export.sh` streams plaintext directly from `pg_dump` to age encryption without saving a plaintext dump file.
7. Run `ops/backup/verify.sh` with `S3_OBJECT_KEY`, the reader credentials, and secured `BACKUP_AGE_IDENTITY_FILE`. Verify SHA-256, age decryption and `pg_restore --list`. This is not the same as proving restore works.
8. Create a **new, empty, disposable Render PostgreSQL database** whose name begins `archon_restore_`. The restore runner requires the explicit host, PostgreSQL PG* connection settings, and `ARCHON_RESTORE_ACK=RESTORE_ONLY_TO_DISPOSABLE_ARCHON_DB`. Run `ops/backup/restore-scratch.sh`; never restore into existing `archon-render-standby-db` or Railway. Compare schema, migration history and row counts against source through an approved read-only method; run application smoke tests.
9. Only after passing the restore drill design a deliberate standby data promotion/cutover. Freeze primary writers; take a final consistent export; restore, verify, deploy app/worker credentials scoped to Render; define DNS/session fallback; practice rollback. **No automatic DNS failover** until RPO/RTO and split-brain handling are tested.

## Important caveats

- A snapshot pipeline is **asynchronous disaster recovery**, not streaming replication. When Railway fails, changes since the last good export can be lost. Cross-cloud HA with near-zero data loss requires a separate replication/CDC/WAL design and careful primary fencing.
- The exporter scripts do not delete objects, apply migrations, touch Railway web/APS or write to production databases.
- A successful HTTP 200 is a connectivity signal; it does not establish that Render contains current Railway application data.
- The existing Render branch remains separately deployed with autoDeploy off. This backup work belongs on a separate review branch and should **not** be merged/deployed until secrets, recovery target and runbook have been reviewed.
- Do not publish actual backup objects, database URLs, age secret keys, cloud access keys or row-level customer data in the GitHub PR.
