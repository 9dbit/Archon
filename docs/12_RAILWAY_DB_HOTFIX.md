# Railway Database Hotfix

The initial production deployment compiled successfully but failed during Railway pre-deploy because `drizzle-kit migrate` expects generated Drizzle migration journal metadata.

This hotfix replaces the Railway migration command implementation with an ARCHON-owned idempotent migration runner:

- `packages/db/src/migrate.ts`
- records applied migrations in `archon_migrations`
- applies `0000_archon_foundation.sql` transactionally
- safely exits when the migration has already been applied

The production seed command is also made idempotent through `seed-safe.ts`, so the Casa Nusa demo project is not duplicated when the seed is intentionally run more than once.
