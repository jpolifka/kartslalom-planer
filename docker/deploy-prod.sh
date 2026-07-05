#!/bin/sh
# Offizieller Produktionsstart: erzwingt den Secret-Preflight, bevor der
# Stack hochfaehrt, statt ihn als optionalen, leicht vergessbaren Schritt
# separat zu dokumentieren.
#
# Verwendung (vom Projekt-Root oder von hier aus):
#   sh docker/deploy-prod.sh

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_ENV="$SCRIPT_DIR/../.env"

# Compose sucht .env sonst im Verzeichnis der Compose-Datei (docker/), nicht
# im Repo-Root -- ohne --env-file werden VITE_SUPABASE_URL/ANON_KEY beim
# Build stillschweigend leer (nur eine WARN-Zeile, kein Abbruch), das
# Frontend startet dann ohne gueltige Supabase-Verbindung.
if [ ! -f "$ROOT_ENV" ]; then
  echo "Fehler: $ROOT_ENV nicht gefunden (VITE_SUPABASE_URL/ANON_KEY fehlen)." >&2
  exit 1
fi

sh "$SCRIPT_DIR/supabase/preflight-check.sh"
docker compose --env-file "$ROOT_ENV" -f "$SCRIPT_DIR/docker-compose.yml" up -d --build
