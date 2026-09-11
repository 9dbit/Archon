# Production Seed Policy

ARCHON demo seeds are explicit operational actions, not automatic deploy hooks.

- Migrations run automatically before deployment.
- Seeds run only when intentionally requested.
- `db:seed` is idempotent and checks for the deterministic Casa Nusa demo project before inserting data.
- Production customer projects must never be created from seed scripts.
