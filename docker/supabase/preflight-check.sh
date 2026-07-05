#!/bin/sh
# Bricht ab, falls docker/supabase/.env noch Demo-/Platzhalter-Secrets aus
# .env.example enthaelt (z.B. weil generate-keys.sh vergessen wurde).
#
# Verwendung:
#   cd docker/supabase
#   sh preflight-check.sh [.env]   # Default: .env im selben Verzeichnis
#
# Exit-Code 0: alles ok. Exit-Code 1: mindestens ein Demo-Wert gefunden,
# Meldung listet ALLE gefundenen Probleme (nicht nur das erste), damit nicht
# nach jedem Fix erneut ausgefuehrt werden muss.

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${1:-$SCRIPT_DIR/.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Fehler: $ENV_FILE nicht gefunden." >&2
  exit 1
fi

# Liest einen Wert aus der .env-Datei (letzte Zuweisung gewinnt, wie bei
# docker compose selbst). Kommentarzeilen und leere VARs werden ignoriert.
read_var() {
  var_name="$1"
  grep -E "^${var_name}=" "$ENV_FILE" | tail -n1 | cut -d= -f2- || true
}

problems=""

add_problem() {
  problems="${problems}  - $1
"
}

# Bekannte Demo-JWTs aus .env.example (Issuer "supabase-demo", von jeder
# Supabase-Self-Host-Anleitung im Internet in identischer Form kopiert).
DEMO_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE"
DEMO_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q"
DEMO_DASHBOARD_PASSWORD="this_password_is_insecure_and_should_be_updated"
DEMO_SECRET_KEY_BASE="UpNVntn3cDxHJpq99YMc1T1AQgQpc8kfYTuRgBiYa15BLrx8etQoXz3gZv1/u2oq"

postgres_password="$(read_var POSTGRES_PASSWORD)"
jwt_secret="$(read_var JWT_SECRET)"
anon_key="$(read_var ANON_KEY)"
service_role_key="$(read_var SERVICE_ROLE_KEY)"
dashboard_password="$(read_var DASHBOARD_PASSWORD)"
secret_key_base="$(read_var SECRET_KEY_BASE)"
vault_enc_key="$(read_var VAULT_ENC_KEY)"

case "$postgres_password" in
  your-super-secret*|"") add_problem "POSTGRES_PASSWORD ist noch der Platzhalter aus .env.example" ;;
esac
case "$jwt_secret" in
  your-super-secret*|"") add_problem "JWT_SECRET ist noch der Platzhalter aus .env.example" ;;
esac
[ "$anon_key" = "$DEMO_ANON_KEY" ] && add_problem "ANON_KEY ist der oeffentliche Supabase-Demo-Key (iss=supabase-demo)"
[ "$service_role_key" = "$DEMO_SERVICE_ROLE_KEY" ] && add_problem "SERVICE_ROLE_KEY ist der oeffentliche Supabase-Demo-Key (iss=supabase-demo)"
[ "$dashboard_password" = "$DEMO_DASHBOARD_PASSWORD" ] && add_problem "DASHBOARD_PASSWORD ist noch der Platzhalter aus .env.example"
[ "$secret_key_base" = "$DEMO_SECRET_KEY_BASE" ] && add_problem "SECRET_KEY_BASE ist noch der Platzhalter aus .env.example"
case "$vault_enc_key" in
  your-32-character*|"") add_problem "VAULT_ENC_KEY ist noch der Platzhalter aus .env.example" ;;
esac

if [ -n "$problems" ]; then
  echo "Fehler: $ENV_FILE enthaelt noch Demo-/Platzhalter-Secrets:" >&2
  printf '%s' "$problems" >&2
  echo "" >&2
  echo "Beheben mit: sh utils/generate-keys.sh --update-env" >&2
  exit 1
fi

echo "OK: keine bekannten Demo-/Platzhalter-Secrets in $ENV_FILE gefunden."
