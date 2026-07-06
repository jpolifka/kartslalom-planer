#!/bin/sh
# Playwright Smoke Tests gegen den lokalen Dev-Stack.
#
# Voraussetzung: Stack läuft bereits.
#   docker compose -f docker/docker-compose.dev.yml up -d
#
# Aufruf (vom Projekt-Root):
#   sh docker/run-playwright-local.sh

set -e

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
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

echo "=== Kartslalom Playwright Smoke Tests ==="
echo "  App:      http://host.docker.internal:5174"
echo "  Supabase: http://kong:8000"
echo ""

docker build \
  -f "$SCRIPT_DIR/Dockerfile.playwright" \
  -t kartslalom-playwright \
  "$(dirname "$SCRIPT_DIR")"

docker run --rm \
  --network kartslalom_default \
  --add-host=host.docker.internal:host-gateway \
  -e SUPABASE_URL=http://kong:8000 \
  -e SUPABASE_ANON_KEY="$ANON_KEY" \
  -e SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  -e PLAYWRIGHT_BASE_URL=http://host.docker.internal:5174 \
  kartslalom-playwright
