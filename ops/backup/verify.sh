#!/usr/bin/env bash
# Read-only verification of an offsite encrypted object.
set -Eeuo pipefail
umask 077
abort() { printf 'ARCHON_BACKUP_VERIFY_FAILED: %s\n' "$*" >&2; exit 1; }
required() { [[ -n "${!1:-}" ]] || abort "Missing required setting: $1"; }
for variable in S3_BUCKET S3_OBJECT_KEY BACKUP_AGE_IDENTITY_FILE; do required "$variable"; done
[[ -r "$BACKUP_AGE_IDENTITY_FILE" ]] || abort "Age identity file is not readable"
[[ "$S3_OBJECT_KEY" == *.pgcustom.age ]] || abort "Only ARCHON encrypted Postgres objects are allowed"
[[ -z "${S3_ENDPOINT_URL:-}" || "$S3_ENDPOINT_URL" == https://* ]] || abort "S3 endpoint must use HTTPS"
for command in age aws sha256sum pg_restore; do command -v "$command" >/dev/null || abort "Missing binary: $command"; done
aws_flags=()
[[ -z "${S3_ENDPOINT_URL:-}" ]] || aws_flags+=(--endpoint-url "$S3_ENDPOINT_URL")
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
filename="${S3_OBJECT_KEY##*/}"
aws "${aws_flags[@]}" s3 cp "s3://$S3_BUCKET/$S3_OBJECT_KEY" "$scratch/$filename" --only-show-errors
aws "${aws_flags[@]}" s3 cp "s3://$S3_BUCKET/$S3_OBJECT_KEY.sha256" "$scratch/$filename.sha256" --only-show-errors
(cd "$scratch" && sha256sum --check "$filename.sha256") >/dev/null || abort "SHA-256 check failed"

# Check decryption and PostgreSQL archive structure without touching a database.
age -d -i "$BACKUP_AGE_IDENTITY_FILE" "$scratch/$filename" | pg_restore --list >/dev/null \
 || abort "Age authentication or pg_restore archive check failed"
printf 'ARCHON_BACKUP_ARCHIVE_VERIFIED key=%s (restore test still required)\n' "$S3_OBJECT_KEY"
