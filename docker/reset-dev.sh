#!/bin/sh
# Vollständiger Reset der lokalen DEV-Umgebung.
# Ausführen vom Projekt-Root: sh docker/reset-dev.sh [-y]
#
# Was passiert:
#   1. Alle Container stoppen + Images entfernen (--rmi all)
#   2. Alle unbenutzten Images system-weit löschen (image prune -af)
#   3. Lokale DB-Daten + Storage löschen
#   4. App-Image neu bauen (--no-cache)
#   5. Stack frisch starten

set -e

COMPOSE_FILE="docker/docker-compose.dev.yml"
VOLUMES_DIR="docker/supabase/volumes"

auto_confirm=0
if [ "$1" = "-y" ]; then
    auto_confirm=1
fi

confirm() {
    [ "$auto_confirm" = "1" ] && return 0
    printf "Fortfahren? Das löscht alle lokalen Dev-Daten. (y/N) "
    read -r REPLY
    case "$REPLY" in
        [Yy]) ;;
        *) echo "Abgebrochen."; exit 1 ;;
    esac
}

echo ""
echo "*** WARNUNG: Alle Container, Images und lokale DB/Storage-Daten werden gelöscht ***"
echo ""
confirm

echo "===> Container stoppen und Images entfernen..."
docker compose -f "$COMPOSE_FILE" down --rmi all --remove-orphans

echo "===> Alle unbenutzten Images bereinigen..."
docker image prune -af

echo "===> Lokale Volume-Daten löschen..."
rm -rf "${VOLUMES_DIR}/db/data"
rm -rf "${VOLUMES_DIR}/storage"
mkdir -p "${VOLUMES_DIR}/storage"

echo "===> App-Image neu bauen (kein Cache)..."
docker compose -f "$COMPOSE_FILE" build --no-cache

echo "===> Frischen Stack starten..."
docker compose -f "$COMPOSE_FILE" up -d

echo ""
echo "Fertig! Der frische DEV-Stack startet gerade."
echo "Supabase Studio: http://localhost:54323"
echo "App:             http://localhost:5174"
