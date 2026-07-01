#!/bin/bash
# Läuft beim ersten DB-Start via docker-entrypoint-initdb.d.
# Wendet alle supabase/migrations/*.sql in sort-Reihenfolge an.
set -e

echo "=== App-Migrationen: Start ==="
for f in $(ls /app-migrations/*.sql 2>/dev/null | sort); do
  echo "  $(basename "$f")"
  psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
done
echo "=== App-Migrationen: fertig ==="
