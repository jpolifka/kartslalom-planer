# Changelog

## 2.5.0

### Added
- **PNG-Export** (Pro): Streckenplan als PNG mit weißem oder transparentem
  Hintergrund exportierbar, direkt im Download-Menü des Editors. Erster
  Feature-Slice unter `src/features/png-export/`.
- **Öffentliche Track-Share-Links** (Pro/Team): widerrufbare, anmeldungsfreie
  Nur-Lese-Links auf eine Strecke (`/share/:token`). 1 aktiver Link pro
  Strecke, kein Ablaufdatum per Default, jederzeit widerrufbar — neues
  Erzeugen ersetzt den alten Link. Details in `docs/track-share-links.md`.

### Security
- Neue RPCs `create_track_share_link`/`revoke_track_share_link`/
  `get_track_by_share_token`: Ownership-, Account- und Tier-Prüfung für die
  Erzeugung, reduzierter öffentlicher Feldsatz ohne Eigentümerdaten/
  Geokoordinaten, einfacher Rate-Limit-Zähler pro Token.
- Öffentlicher Share-Viewer zeigt bewusst keinen Kartenhintergrund (Esri-
  Nutzungsbedingungen erlauben kostenlosen Zugriff nur für "Noncommercial
  Use"; aktuell unkritisch, da kein monetäres Modell aktiv ist, aber vor
  echter Bezahlung neu zu bewerten — siehe `docs/track-share-links.md`) und
  rendert das SVG über ein `<img data:>`-Element statt
  `dangerouslySetInnerHTML`, um Stored-XSS über Custom-Formation-Labels für
  anonyme Besucher auszuschließen.

### Fixed
- Lokale Dev-Umgebung: `docker/supabase/.env.example` zeigte noch auf die
  SMTP-Werte des ursprünglichen Supabase-Templates (`supabase-mail`:2500,
  inbucket) statt auf den tatsächlich verwendeten Mailpit-Dienst
  (`supabase-mailpit`:1025) — frische Setups bekamen dadurch einen
  kaputten Login (500 bei OTP-Anfrage, Mail-Zustellung schlägt fehl).

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
