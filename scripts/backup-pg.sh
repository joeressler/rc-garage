#!/usr/bin/env bash
# Purpose: dump rc-db to a dated SQL file without exposing compose ports off loopback.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-rc_garage_admin}"
POSTGRES_DB="${POSTGRES_DB:-rc_garage_prod}"
mkdir -p backups
STAMP="$(date +%Y%m%d)"
OUT="backups/rc-garage-${STAMP}.sql"

docker compose exec -T rc-db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$OUT"
echo "Wrote $OUT"
