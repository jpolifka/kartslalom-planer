# Migrationen

Diese SQL-Dateien sind die einzige Quelle für das App-Schema
(`profiles`, `tracks`, `track_versions`, `custom_formations`, `formation_shares`,
`app_config`, RLS-Policies, SECURITY-DEFINER-Funktionen). Die ersten drei Dateien
(`20260615120000_app_schema.sql` bis `…120002_app_functions.sql`) legen die
Grundstruktur an, siehe `docs/planning/IMPLEMENTATION_PLAN.md`.

Das Schema läuft ausschließlich auf dem **self-hosted Supabase-Stack**
(`docker/supabase/`), lokal wie in Produktion — es gibt kein Supabase-Cloud-Projekt
mehr (siehe `docs/adr/0001-self-hosted-supabase.md`).

- **Frischer Stack (leeres `docker/supabase/volumes/db/data/`):**
  `docker/supabase/docker-compose.yml` mountet diesen Ordner
  (`../../supabase/migrations:/app-migrations:ro`) in den Postgres-Container;
  `migrate.sh` führt beim ersten Start alle `*.sql`-Dateien in Sortierreihenfolge
  aus und vermerkt jede in `public._applied_migrations`. Neue Dateien hier werden
  automatisch erfasst — **kein** zusätzlicher Mount-Eintrag nötig.
- **Laufender Stack (Produktion, bestehender Dev-Stack):** Die Init-Skripte laufen
  nur bei leerem Datenverzeichnis. Neue Migrationen werden auf dem Docker-Host mit
  `sh docker/supabase/apply-migrations.sh` angewendet; bereits in
  `public._applied_migrations` vermerkte Dateien werden übersprungen.
- **Lokal von vorn beginnen:** `sh docker/supabase/reset.sh` (löscht die Daten und
  führt alle Migrationen erneut aus).

## Neue Migrationen hinzufügen

Neue Datei mit Timestamp-Präfix `YYYYMMDDHHMMSS_beschreibung.sql` anlegen
(Reihenfolge = Ausführungsreihenfolge). Vor dem Merge gilt das Pflichttest-Protokoll
und die Migrations-Checkliste in `CONTRIBUTING.md`.
