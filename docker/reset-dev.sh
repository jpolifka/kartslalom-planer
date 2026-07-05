#!/bin/sh
# Vollständiger Reset der lokalen DEV-Umgebung.
# Ausführen vom Projekt-Root: sh docker/reset-dev.sh [-y] [--prune]
#
# Was passiert:
#   1. Alle Container stoppen + Images entfernen (--rmi all)
#   2. Lokale DB-Daten + Storage löschen
#   3. App-Image neu bauen (--no-cache)
#   4. Stack frisch starten
#
# Mit --prune: Alle unbenutzten Images system-weit löschen (Achtung: betrifft alle Docker-Images,
#              nicht nur dieses Projekt — auf geteilten Hosts mit Bedacht verwenden).

set -e

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.dev.yml"
VOLUMES_DIR="$SCRIPT_DIR/supabase/volumes"

auto_confirm=0
do_prune=0
for arg in "$@"; do
    case "$arg" in
        -y) auto_confirm=1 ;;
        --prune) do_prune=1 ;;
    esac
done

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
docker compose --profile dev -f "$COMPOSE_FILE" down --rmi all --remove-orphans

if [ "$do_prune" = "1" ]; then
    echo "===> Alle unbenutzten Images system-weit bereinigen (--prune)..."
    docker image prune -af
fi

echo "===> Lokale Volume-Daten löschen..."
rm -rf "${VOLUMES_DIR}/db/data"
rm -rf "${VOLUMES_DIR}/storage"
mkdir -p "${VOLUMES_DIR}/storage"

echo "===> App-Image neu bauen (kein Cache)..."
docker compose --profile dev -f "$COMPOSE_FILE" build --no-cache

echo "===> Frischen Stack starten..."
# --profile dev noetig, damit Mailpit (Magic-Link-Mailcatcher) mitstartet --
# ohne dev-Profil bleibt der Service inaktiv (siehe supabase/docker-compose.yml).
docker compose --profile dev -f "$COMPOSE_FILE" up -d

echo ""
echo "Fertig! Der frische DEV-Stack startet gerade."
echo "Supabase Studio: http://localhost:54323"
echo "App:             http://localhost:5174"
