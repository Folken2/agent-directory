#!/usr/bin/env bash
# Local development database (docker-compose.dev.yml at the repo root).
#
#   scripts/dev-db.sh up      start Postgres + the Neon HTTP proxy
#   scripts/dev-db.sh reset   wipe the database and recreate the web app schema
#   scripts/dev-db.sh down    stop the containers (data volume is kept)
#   scripts/dev-db.sh psql    open a psql shell
#
# The schema comes from the Drizzle schema files (drizzle-kit export), so no
# remote database is needed. Tables created at runtime (community posts,
# analytics extras, ADK sessions/events) bootstrap themselves on first use.
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE=(docker compose -f ../docker-compose.dev.yml -p agent-directory-dev)
PSQL=("${COMPOSE[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U postgres -d main)

wait_ready() {
  for _ in $(seq 1 30); do
    if "${COMPOSE[@]}" exec -T postgres pg_isready -U postgres -d main >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "Postgres did not become ready" >&2
  exit 1
}

case "${1:-}" in
  up)
    "${COMPOSE[@]}" up -d
    wait_ready
    echo "DATABASE_URL=postgres://postgres:postgres@db.localtest.me:5433/main"
    ;;
  reset)
    wait_ready
    "${PSQL[@]}" -q -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
    npx drizzle-kit export --dialect=postgresql --schema='./lib/drizzle/schema/*' | "${PSQL[@]}" -q
    echo "Local database reset."
    ;;
  down)
    "${COMPOSE[@]}" down
    ;;
  psql)
    "${COMPOSE[@]}" exec postgres psql -U postgres -d main
    ;;
  *)
    sed -n '2,8p' "$0"
    exit 1
    ;;
esac
