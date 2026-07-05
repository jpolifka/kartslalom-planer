#!/bin/sh
# Offizieller Produktionsstart: erzwingt den Secret-Preflight, bevor der
# Stack hochfaehrt, statt ihn als optionalen, leicht vergessbaren Schritt
# separat zu dokumentieren.
#
# Verwendung (vom Projekt-Root oder von hier aus):
#   sh docker/deploy-prod.sh

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

sh "$SCRIPT_DIR/supabase/preflight-check.sh"
docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d --build
