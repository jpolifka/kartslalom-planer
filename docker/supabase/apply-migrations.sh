#!/bin/bash
# Wendet neue supabase/migrations/*.sql auf einen LAUFENDEN Container an.
# Bereits angewendete Migrationen werden via Tracking-Tabelle übersprungen.
#
# Verwendung:
#   cd docker/supabase
#   ./apply-migrations.sh                  # Standard-Container (supabase-db)
#   SUPABASE_DB_CONTAINER=my-db ./apply-migrations.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS_DIR="$(cd "$SCRIPT_DIR/../../supabase/migrations" && pwd)"
CONTAINER="${SUPABASE_DB_CONTAINER:-supabase-db}"
DB="postgres"

echo "=== apply-migrations.sh ==="
echo "Container : $CONTAINER"
echo "Migrations: $MIGRATIONS_DIR"
echo ""

# Tracking-Tabelle anlegen (idempotent)
docker exec "$CONTAINER" psql -U postgres -d "$DB" -c "
  CREATE TABLE IF NOT EXISTS public._applied_migrations (
    filename   text        PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  );
" > /dev/null

# Migrationen, die vor Einführung des Trackings bereits angewendet wurden.
# Nur als "angewendet" markieren, nicht erneut ausführen.
LEGACY=(
  "20260615120000_app_schema.sql"
  "20260615120001_app_rls.sql"
  "20260615120002_app_functions.sql"
  "20260619000001_security_p1_is_deleted_check.sql"
  "20260619000002_revoke_profiles_write.sql"
  "20260622000001_h0_schema.sql"
  "20260622000002_h0_rls.sql"
  "20260622000003_h0_functions.sql"
  "20260629000001_h3_sharing.sql"
  "20260629000002_fix_shared_rls.sql"
  "20260629000003_get_shared_get_library_rpcs.sql"
  "20260701000001_h3_completion.sql"
  "20260701000002_h4_admin_tracks.sql"
)
for name in "${LEGACY[@]}"; do
  docker exec "$CONTAINER" psql -U postgres -d "$DB" -c \
    "INSERT INTO public._applied_migrations (filename) VALUES ('$name') ON CONFLICT DO NOTHING;" \
    > /dev/null 2>&1 || true
done

# Neue Migrationen anwenden
APPLIED=0
SKIPPED=0

for filepath in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  filename=$(basename "$filepath")

  already=$(docker exec "$CONTAINER" psql -U postgres -d "$DB" -tAc \
    "SELECT 1 FROM public._applied_migrations WHERE filename='$filename'" 2>/dev/null \
    | tr -d '[:space:]')

  if [ "$already" = "1" ]; then
    echo "  skip  $filename"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo "  apply $filename ..."
  # Zuerst als postgres (Superuser), bei RLS-Fehlern als supabase_admin
  if ! docker exec -i "$CONTAINER" \
       psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 < "$filepath" > /dev/null 2>/tmp/mg-err; then
    echo "    → Wiederholung als supabase_admin"
    docker exec -i "$CONTAINER" \
      psql -U supabase_admin -d "$DB" -v ON_ERROR_STOP=1 < "$filepath"
  fi

  docker exec "$CONTAINER" psql -U postgres -d "$DB" -c \
    "INSERT INTO public._applied_migrations (filename) VALUES ('$filename') ON CONFLICT DO NOTHING;" \
    > /dev/null
  APPLIED=$((APPLIED + 1))
  echo "    ✓"
done

echo ""
echo "=== Fertig: $APPLIED angewendet, $SKIPPED übersprungen ==="
