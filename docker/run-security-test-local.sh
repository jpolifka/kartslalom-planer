#!/bin/sh
# Sicherheits-Rauchtest gegen den lokalen Dev-Stack.
#
# Voraussetzung: lokaler Stack läuft bereits.
#   docker compose -f docker/docker-compose.dev.yml up -d
#
# Aufruf (vom Projekt-Root):
#   sh docker/run-security-test-local.sh

set -e

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

cleanup() {
  docker image rm kartslalom-security-test 2>/dev/null || true
}
trap cleanup EXIT
SUPABASE_ENV="$SCRIPT_DIR/supabase/.env"

if [ ! -f "$SUPABASE_ENV" ]; then
  echo "Fehler: $SUPABASE_ENV nicht gefunden."
  echo "Lokaler Dev-Stack läuft? Starte ihn mit:"
  echo "  docker compose -f docker/docker-compose.dev.yml up -d"
  exit 1
fi

ANON_KEY=$(grep "^ANON_KEY=" "$SUPABASE_ENV" | cut -d= -f2-)
SERVICE_ROLE_KEY=$(grep "^SERVICE_ROLE_KEY=" "$SUPABASE_ENV" | cut -d= -f2-)

if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "Fehler: ANON_KEY oder SERVICE_ROLE_KEY nicht in $SUPABASE_ENV gefunden."
  exit 1
fi

SUPABASE_URL=http://kong:8000 \
SUPABASE_ANON_KEY="$ANON_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
docker compose -p kartslalom \
  -f "$SCRIPT_DIR/docker-compose.dev.yml" \
  -f "$SCRIPT_DIR/docker-compose.test.yml" \
  run --rm --no-deps security-test
