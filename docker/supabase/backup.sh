#!/bin/bash
# Sichert den self-hosted Supabase-Stack: Postgres-Dump + Storage-Bind-Mount.
#
# Verwendung:
#   cd docker/supabase
#   ./backup.sh                     # Standard-Container (supabase-db)
#   SUPABASE_DB_CONTAINER=my-db ./backup.sh
#
# Legt ab unter docker/supabase/backups/db_<timestamp>.sql.gz und
# storage_<timestamp>.tar.gz. Aeltere Backups als $RETENTION_DAYS werden
# danach geloescht (Default 14 Tage).
#
# PROD-RISK: Diese Backups enthalten personenbezogene Nutzerdaten (Accounts,
# Tracks) im Klartext. NICHT ins Git-Repo committen (backups/ ist gitignored,
# siehe .gitignore) und beim Kopieren auf ein Offsite-Ziel verschluesselt
# uebertragen (z.B. rclone/rsync per SSH statt unverschluesseltem Transfer).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backups"
STORAGE_DIR="$SCRIPT_DIR/volumes/storage"
CONTAINER="${SUPABASE_DB_CONTAINER:-supabase-db}"
DB="postgres"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

# Fehlt der Container, wuerde pg_dump erst nach langem Timeout scheitern --
# hier frueh und mit klarer Fehlermeldung abbrechen.
if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Fehler: Container '$CONTAINER' laeuft nicht." >&2
  exit 1
fi

echo "=== backup.sh ==="
echo "Container: $CONTAINER"
echo "Ziel:      $BACKUP_DIR"
echo ""

echo "===> Postgres-Dump..."
DB_DUMP="$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"
docker exec "$CONTAINER" pg_dump -U postgres -d "$DB" | gzip > "$DB_DUMP"
echo "    -> $DB_DUMP"

echo "===> Storage-Archiv..."
if [ -d "$STORAGE_DIR" ]; then
  STORAGE_ARCHIVE="$BACKUP_DIR/storage_${TIMESTAMP}.tar.gz"
  tar -czf "$STORAGE_ARCHIVE" -C "$SCRIPT_DIR/volumes" storage
  echo "    -> $STORAGE_ARCHIVE"
else
  echo "    Uebersprungen: $STORAGE_DIR existiert nicht."
fi

echo "===> Alte Backups aufraeumen (aelter als ${RETENTION_DAYS} Tage)..."
find "$BACKUP_DIR" -name '*.gz' -mtime "+${RETENTION_DAYS}" -print -delete

echo ""
echo "=== Fertig ==="
