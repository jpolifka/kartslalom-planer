#!/bin/sh
# Integrationstests gegen den lokalen Dev-Stack.
#
# Voraussetzung: lokaler Stack läuft bereits.
#   docker compose -f docker/docker-compose.dev.yml up -d
#
# Aufruf (vom Projekt-Root):
#   sh docker/run-integration-test-local.sh

set -e

SUPABASE_ENV="docker/supabase/.env"

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

echo "=== Kartslalom Integrationstests ==="
echo "  Target: http://kong:8000 (lokaler Dev-Stack)"
echo ""

docker exec \
  -e SUPABASE_URL=http://kong:8000 \
  -e SUPABASE_ANON_KEY="$ANON_KEY" \
  -e SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  kartslalom-kartslalom-dev-1 \
  npm run test:integration
