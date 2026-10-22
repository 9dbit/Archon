#!/usr/bin/env bash
# Manual restore into a NEW, EMPTY and explicitly named disposable Render DB.
# Never run this against Railway production or the live Render standby DB.
set -Eeuo pipefail
umask 077
abort() { printf 'ARCHON_SCRATCH_RESTORE_ABORT: %s\n' "$*" >&2; exit 1; }
required() { [[ -n "${!1:-}" ]] || abort "Missing required setting: $1"; }

[[ "${ARCHON_RESTORE_ACK:-}" == "RESTORE_ONLY_TO_DISPOSABLE_ARCHON_DB" ]] || abort "Manual restore acknowledgment missing"
[[ -z "${RAILWAY_PROJECT_ID:-}" ]] || abort "Cannot run restore on Railway"
[[ -z "${DATABASE_URL:-}" ]] || abort "Refusing inherited application DATABASE_URL"
for variable in PGHOST PGPORT PGUSER PGPASSWORD ARCHON_RESTORE_DB_NAME ARCHON_ALLOWED_RESTORE_HOST S3_BUCKET S3_OBJECT_KEY BACKUP_AGE_IDENTITY_FILE; do required "$variable"; done
[[ "$ARCHON_RESTORE_DB_NAME" =~ ^archon_restore_[a-zA-Z0-9_]+$ ]] || abort "Target DB must use archon_restore_ prefix"
[[ "$PGHOST" == "$ARCHON_ALLOWED_RESTORE_HOST" && "$PGHOST" == dpg-* ]] || abort "Target is not the explicitly permitted Render host"
[[ -r "$BACKUP_AGE_IDENTITY_FILE" ]] || abort "Missing age identity file"
[[ "$S3_OBJECT_KEY" == *.pgcustom.age ]] || abort "Unexpected archive extension"
[[ -z "${S3_ENDPOINT_URL:-}" || "$S3_ENDPOINT_URL" == https://* ]] || abort "S3 endpoint must use HTTPS"
export PGDATABASE="$ARCHON_RESTORE_DB_NAME"
export PGOPTIONS="-c statement_timeout=0"

actual_db="$(psql -AtX -v ON_ERROR_STOP=1 -c 'SELECT current_database()')" || abort "Cannot connect to scratch database"
[[ "$actual_db" == "$ARCHON_RESTORE_DB_NAME" ]] || abort "Wrong target DB"
table_count="$(psql -AtX -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') AND schemaname NOT LIKE 'pg_toast%'" )"
[[ "$table_count" == "0" ]] || abort "Scratch target is not empty"

aws_flags=()
[[ -z "${S3_ENDPOINT_URL:-}" ]] || aws_flags+=(--endpoint-url "$S3_ENDPOINT_URL")
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
filename="${S3_OBJECT_KEY##*/}"
aws "${aws_flags[@]}" s3 cp "s3://$S3_BUCKET/$S3_OBJECT_KEY" "$scratch/$filename" --only-show-errors
aws "${aws_flags[@]}" s3 cp "s3://$S3_BUCKET/$S3_OBJECT_KEY.sha256" "$scratch/$filename.sha256" --only-show-errors
(cd "$scratch" && sha256sum --check "$filename.sha256") >/dev/null || abort "Archive SHA-256 check failed"

# Transactional restore. A failure rolls back target SQL; source is never touched.
age -d -i "$BACKUP_AGE_IDENTITY_FILE" "$scratch/$filename" \
 | pg_restore --dbname="$ARCHON_RESTORE_DB_NAME" --no-owner --no-acl --exit-on-error --single-transaction \
 || abort "Scratch restore failed"
printf 'ARCHON_SCRATCH_RESTORE_OK target=%s; app standby NOT switched\n' "$ARCHON_RESTORE_DB_NAME"
