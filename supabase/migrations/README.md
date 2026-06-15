# Migrationen

Diese SQL-Dateien sind die einzige Quelle fuer das App-Schema
(`profiles`, `tracks`, `track_versions`, RLS-Policies, SECURITY DEFINER
Funktionen — Phase 0.5-0.7, siehe `docs/planning/IMPLEMENTATION_PLAN.md`).

- **Lokal (Docker):** `docker/supabase/docker-compose.yml` mountet diese
  Dateien direkt in den Postgres-Container und fuehrt sie beim ersten Start
  (leeres `docker/supabase/volumes/db/data/`) automatisch aus.
- **Supabase Cloud (Produktion):** Dateien in dieser Reihenfolge im
  SQL-Editor des Supabase-Projekts (Region Frankfurt, `eu-central-1`)
  ausfuehren:
  1. `20260615120000_app_schema.sql`
  2. `20260615120001_app_rls.sql`
  3. `20260615120002_app_functions.sql`

  Alternativ mit der Supabase CLI: `supabase link` auf das Cloud-Projekt,
  dann `supabase db push` — die CLI fuehrt alle Dateien hier in
  Datumsreihenfolge aus.

## Neue Migrationen hinzufuegen

Neue Datei mit Timestamp-Praefix `YYYYMMDDHHMMSS_beschreibung.sql` anlegen
(Reihenfolge = Ausfuehrungsreihenfolge). Fuer den lokalen Docker-Stack
zusaetzlich einen Mount-Eintrag in `docker/supabase/docker-compose.yml`
(Service `db`, Abschnitt `volumes`) ergaenzen — Init-Skripte laufen dort
nur bei leerem Datenverzeichnis (`sh docker/supabase/reset.sh` fuer einen
Neustart mit leerem Schema).
