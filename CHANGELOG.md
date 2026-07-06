# Changelog

## 2.2.1

### Fixed
- Der automatische Security-Smoke-CI-Job (ephemerer self-hosted Supabase-Stack im Runner)
  schlug seit Einführung zuverlässig fehl: Der Supavisor-Pooler-Container crash-loopte auf
  GitHub-Actions-Runnern, weil sein Entrypoint beim Setzen von `ulimit -n 100000` ohne
  ausreichende Rechte sofort abbrach. Explizites `ulimits`-Limit auf dem Service behoben.
- Ein redundanter, expliziter Migrations-Schritt in der ephemeren CI-Pipeline versuchte,
  bereits automatisch angewendete Migrationen erneut auszuführen und scheiterte dabei an
  einer geänderten Funktionssignatur (`admin_list_tracks`). Schritt entfernt — Migrationen
  laufen bei frischen Stacks bereits automatisch beim Datenbank-Start.
- Der Security-Test-Docker-Build scheiterte im CI-Runner an fehlenden Leserechten auf
  Postgres-Laufzeitdateien im Build-Context. `.dockerignore` um die Supabase-Laufzeitdaten
  ergänzt.
- Der manuelle `full-test`-Workflow (`workflow_dispatch`) validierte die Compose-Konfiguration
  vor Erzeugung der dafür nötigen `.env`-Datei und schlug dadurch zuverlässig fehl.

### Changed
- CI-Trigger vereinfacht: `push` läuft nur noch auf `main`, um doppelte Läufe bei offenen
  Pull Requests zu vermeiden. Reine Dokumentationsänderungen (`docs/**`, `**/*.md`) lösen
  keinen CI-Lauf mehr aus.

## 2.2.0

### Fixed
- Trackname wird jetzt serverseitig einheitlich auf 100 Zeichen begrenzt (`create_track`,
  `rename_track`, `create_track_from_version`) — zu lange Namen schlagen mit `invalid_name`
  fehl, statt ungeprüft gespeichert zu werden.
- Das Tier-Track-Limit (`create_track`, `create_track_from_version`) ist jetzt race-sicher:
  parallele Aufrufe desselben Nutzers am Limit können das Limit nicht mehr durch eine
  Count-dann-Insert-Race-Condition überschreiten (`FOR UPDATE`-Sperre auf der Profilzeile).

### Security
- Neue Tests: anonymer Aufruf von `create_track_from_version` (`permission denied`),
  gelöschter Account, Namenslänge (Grenzfall und Überschreitung), parallele Aufrufe am
  Tier-Limit für `create_track` und `create_track_from_version`.

## 2.1.0

### Added
- Versionen können jetzt als eigenständige neue Strecke gespeichert werden
  ("Speichern unter"), ohne die Ursprungsstrecke zu verändern.
- Neuer Button „Als neue Strecke speichern" in der Versionsliste im Dashboard.
- Neuer Button „Speichern unter…" im schreibgeschützten Vorschau-Banner im Editor.
- Neue Integrations-, Unit- und E2E-Tests für den Save-As-Workflow.

### Security
- Neue RPC `create_track_from_version`: Ownership-, Account-, Tier-, Tracklimit- und
  Satellite-Prüfung, nur für `authenticated` ausführbar (Least-Privilege).
