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

# Direkter Glob statt "$(ls ... | sort)": Kommandosubstitution wird von der Shell an
# Whitespace aufgesplittet, bevor die for-Schleife sie sieht -- bei einem Repo-Pfad mit
# Leerzeichen (z.B. lokale Checkouts unter "…/4. Kartsport/…") wurde jede Migration nach
# dem ersten Leerzeichen im Pfad zu einem eigenen, nicht existierenden "Dateinamen"
# zerschnitten ("apply-migrations.sh: line 72: /…/4.: No such file or directory"). Der
# Glob expandiert direkt zu vollstaendigen, korrekt gequoteten Pfadelementen und ist
# bereits lexikalisch sortiert (identisch zu | sort fuer die YYYYMMDDHHMMSS-Praefixe).
for filepath in "$MIGRATIONS_DIR"/*.sql; do
  [ -e "$filepath" ] || continue  # keine *.sql-Datei gefunden -- Glob bleibt sonst woertlich stehen
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
  # supabase_admin zuerst: dieselbe Rolle, mit der migrate.sh App-Migrationen bei der
  # Erstinstallation ausfuehrt (siehe migrate.sh), und die Owner-Rolle aller bestehenden
  # Tabellen/Funktionen in public. Zwei am lokalen Stack empirisch nachgewiesene Gruende,
  # warum die Rolle hier wirklich zaehlt (nicht nur Stil):
  #  1) Eine von "postgres" NEU angelegte Funktion bekommt "postgres" eigene
  #     Default-Privilegien, die anon/PUBLIC (anders als bei supabase_admin, siehe
  #     20260713000002_harden_public_function_grants.sql) ausdruecklich EXECUTE geben --
  #     unabhaengig von jeder Haertungs-Migration, da ALTER DEFAULT PRIVILEGES nur fuer
  #     die Rolle wirkt, die die Anweisung selbst ausgefuehrt hat.
  #  2) "postgres" ist in diesem self-hosted Rollenmodell KEIN Objekt-Owner-Bypass-Superuser:
  #     ein GRANT/REVOKE auf ein von supabase_admin besessenes Objekt schlaegt entweder mit
  #     "must be owner of ..." fehl, oder laeuft bei einem Batch-REVOKE (z.B. "on all
  #     functions in schema public") nur mit einer stillen WARNING statt eines Fehlers ins
  #     Leere -- ein REVOKE-Statement in einer Migration kann so scheinbar erfolgreich
  #     durchlaufen, ohne tatsaechlich etwas zu bewirken.
  # postgres bleibt dennoch Fallback fuer Faelle, in denen supabase_admin an einem
  # Statement scheitert (set -e/ON_ERROR_STOP wuerde sonst den ganzen Lauf abbrechen) --
  # das Grant-Audit unten faengt ab, was dabei an anon-Rechten uebrig bleiben koennte,
  # STATT sich auf die Rollen-Reihenfolge allein zu verlassen. Jede neue Funktion braucht
  # trotzdem ihr eigenes explizites "revoke execute ... from public, anon" (siehe
  # CONTRIBUTING.md-Checkliste) -- das ist die eigentliche Absicherung, die Rollen-
  # Reihenfolge hier reduziert nur, wie oft der Fallback ueberhaupt noetig wird.
  if ! docker exec -i "$CONTAINER" \
       psql -U supabase_admin -d "$DB" -v ON_ERROR_STOP=1 < "$filepath" > /dev/null 2>/tmp/mg-err; then
    echo "    → Wiederholung als postgres"
    docker exec -i "$CONTAINER" \
      psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 < "$filepath"
  fi

  docker exec "$CONTAINER" psql -U postgres -d "$DB" -c \
    "INSERT INTO public._applied_migrations (filename) VALUES ('$filename') ON CONFLICT DO NOTHING;" \
    > /dev/null
  APPLIED=$((APPLIED + 1))
  echo "    ✓"
done

echo ""
echo "=== Fertig: $APPLIED angewendet, $SKIPPED übersprungen ==="

# Grant-Audit: unabhaengig davon, welche Rolle welche Migration oben tatsaechlich
# ausgefuehrt hat (supabase_admin, oder im Fallback-Fall postgres), hier noch einmal
# GEGENPRUEFEN statt der Rollen-Reihenfolge blind zu vertrauen -- dieselbe Lueckenklasse
# wie beim Red-Team-Review 2026-07-13 (Kong-CORS/RPC-Grants), nur diesmal fuer Funktionen,
# die NACH jener Haertung neu hinzukommen. Nutzt debug_list_function_grants() (service_
# role-only fuer normale Clients, aber per Superuser-Verbindung hier aufrufbar) --
# dieselbe Quelle wie src/__integration__/rpc-grants.test.ts, das denselben Katalog in CI
# prueft (dort aber nur gegen einen frisch per migrate.sh initialisierten Stack, nicht
# gegen den hier relevanten Produktions-Pfad ueber dieses Skript).
echo ""
echo "=== Grant-Audit: anon darf nur bewusst öffentliche RPCs ausführen ==="
HAS_AUDIT_FN=$(docker exec "$CONTAINER" psql -U postgres -d "$DB" -tAc \
  "SELECT 1 FROM pg_proc WHERE proname = 'debug_list_function_grants' AND pronamespace = 'public'::regnamespace" \
  2>/dev/null | tr -d '[:space:]')

if [ "$HAS_AUDIT_FN" != "1" ]; then
  echo "  (übersprungen: debug_list_function_grants() nicht vorhanden -- Migration"
  echo "   20260713000005_debug_function_grants_introspection.sql noch nicht angewendet)"
else
  # Allowlist identisch zu INTENTIONALLY_PUBLIC in rpc-grants.test.ts -- bei einer
  # künftigen bewusst öffentlichen RPC beide Stellen pflegen.
  UNEXPECTED=$(docker exec "$CONTAINER" psql -U postgres -d "$DB" -tAc "
    SELECT string_agg(function_name || '(' || arguments || ')', ', ')
    FROM public.debug_list_function_grants()
    WHERE anon_can_execute
      AND function_name NOT IN ('get_library_formations', 'get_track_by_share_token');
  " 2>/dev/null)

  if [ -n "$UNEXPECTED" ]; then
    echo "  ✗ FEHLER: anon hat EXECUTE auf nicht dafür vorgesehene Funktion(en): $UNEXPECTED"
    echo "    Vermutlich wurde eine neue Funktion als Rolle 'postgres' statt 'supabase_admin'"
    echo "    angelegt (PostgreSQLs PUBLIC-Default), oder es fehlt ein explizites"
    echo "    'revoke execute ... from public, anon' in der jeweiligen Migration."
    echo "    Manuell beheben: revoke execute on function public.<name>(<argtypen>) from public, anon;"
    exit 1
  fi
  echo "  ✓ Keine unerwarteten anon-Rechte gefunden."
fi
