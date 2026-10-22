#!/usr/bin/env bash
# Encrypted logical snapshot. Run ONLY in a dedicated Railway one-shot job.
set -Eeuo pipefail
umask 077
abort() { printf 'ARCHON_BACKUP_ABORT: %s\n' "$*" >&2; exit 1; }
required() { [[ -n "${!1:-}" ]] || abort "Missing required setting: $1"; }

# Hard guard against accidental export from an unrelated database or environment.
[[ "${ARCHON_BACKUP_ARMED:-}" == "I_ACKNOWLEDGE_READ_ONLY_EXPORT" ]] || abort "Export is not armed"
[[ "${RAILWAY_PROJECT_ID:-}" == "cb0578cf-1bc9-4023-9657-e161ed814127" ]] || abort "Wrong Railway project"
[[ "${RAILWAY_ENVIRONMENT_NAME:-}" == "production" ]] || abort "Not the Railway production environment"
for variable in DATABASE_URL ARCHON_EXPECTED_DATABASE BACKUP_AGE_RECIPIENT S3_BUCKET; do required "$variable"; done
[[ "$BACKUP_AGE_RECIPIENT" == age1* ]] || abort "Use an age X25519 public recipient (age1...)"
[[ "$S3_BUCKET" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]+$ ]] || abort "Invalid bucket name"
[[ -z "${S3_ENDPOINT_URL:-}" || "$S3_ENDPOINT_URL" == https://* ]] || abort "S3 endpoint must use HTTPS"

# This setting applies read-only transactions to both preflight and pg_dump.
export PGOPTIONS="-c default_transaction_read_only=on"
actual_db="$(psql -d "$DATABASE_URL" -AtX -v ON_ERROR_STOP=1 -c 'SELECT current_database()')" || abort "Database preflight failed"
[[ "$actual_db" == "$ARCHON_EXPECTED_DATABASE" ]] || abort "Database name mismatch"
for command in pg_dump age aws sha256sum stat openssl; do command -v "$command" >/dev/null || abort "Missing binary: $command"; done

scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
nonce="$(openssl rand -hex 5)"
filename="archon-${stamp}-${nonce}.pgcustom.age"
archive="$scratch/$filename"
prefix="${S3_KEY_PREFIX:-archon/production-postgres}"
prefix="${prefix#/}"; prefix="${prefix%/}"
key="$prefix/$filename"
aws_flags=()
[[ -z "${S3_ENDPOINT_URL:-}" ]] || aws_flags+=(--endpoint-url "$S3_ENDPOINT_URL")

# Data is encrypted while streaming out of pg_dump. No plaintext dump is saved.
pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner --no-acl --compress=6 | age -r "$BACKUP_AGE_RECIPIENT" -o "$archive"
[[ -s "$archive" ]] || abort "Empty encrypted export"
checksum="$(sha256sum "$archive" | cut -d ' ' -f 1)"
printf '%s  %s\n' "$checksum" "$filename" > "$archive.sha256"
aws "${aws_flags[@]}" s3 cp "$archive" "s3://$S3_BUCKET/$key" --only-show-errors
remote_bytes="$(aws "${aws_flags[@]}" s3api head-object --bucket "$S3_BUCKET" --key "$key" --query ContentLength --output text)"
local_bytes="$(stat -c %s "$archive")"
[[ "$remote_bytes" == "$local_bytes" ]] || abort "Remote archive size mismatch"
aws "${aws_flags[@]}" s3 cp "$archive.sha256" "s3://$S3_BUCKET/$key.sha256" --only-show-errors
printf 'ARCHON_BACKUP_EXPORT_OK key=%s bytes=%s sha256=%s\n' "$key" "$local_bytes" "$checksum"
