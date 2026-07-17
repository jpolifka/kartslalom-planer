# Changelog

## 2.6.1

### Security
- **SVG-/XML-Injection im Export geschlossen**: Formation-Labels und Karten-Attribution
  landeten unescaped im generierten SVG (betrifft SVG-Download, PDF- und PNG-Export) — ein
  frei benannter eigener Formationsname konnte aktive Elemente einschleusen. Jetzt
  konsequent escaped, mit Injection-Tests für `<script>`, `<foreignObject>`,
  Event-Handler und XML-Sonderzeichen.
- **RPC-Ausführungsrechte systematisch gehärtet**: `anon` hatte zuvor auf praktisch allen
  RPCs EXECUTE — sowohl über eine self-hosted-spezifische Default-Privilege-Regel als auch
  über PostgreSQLs eingebauten PUBLIC-Default (beide unabhängig voneinander revoked). Nur
  die zwei bewusst öffentlichen RPCs (`get_library_formations`, `get_track_by_share_token`)
  bleiben freigegeben. Neuer automatisierter Test prüft das dynamisch über den gesamten
  `public`-Funktionsbestand statt per Stichprobe.
- **Kong-CORS-Wildcard geschlossen**: Das CORS-Plugin lief an 15 API-Routen
  (auth/rest/storage/functions/realtime) ohne Origin-Einschränkung; jetzt explizite
  Allowlist statt `Access-Control-Allow-Origin: *`.
- **Welcome-Mail idempotent**: wiederholte Aufrufe im 5-Minuten-Fenster lösen keine
  Mehrfach-Mails mehr aus; ein Claim wird bei fehlgeschlagenem Versand (z. B.
  Resend-Fehler) korrekt zurückgerollt statt den Nutzer dauerhaft zu blockieren.
- **Account-Löschung vervollständigt**: der self-hosted Live-Pfad rief die
  Bereinigungs-RPC nicht auf und löschte persönliche Custom-Formationen dadurch nicht
  wirklich (nur ownerlos statt entfernt) — jetzt korrekt, live verifiziert.
- Öffentlicher Share-Link-Lesepfad ohne unnötigen Row-Lock; Notfall-Rate-Limit von 120 auf
  3000 Aufrufe/Stunde angehoben (war zugleich einzige aktive Schutzschicht und DoS-Vektor
  gegen den Link-Eigentümer).

### Fixed
- Produktionsbuild (`npm run build`) wieder grün — ein ES2021-only API (`String.replaceAll`)
  kompilierte nicht gegen das ES2020-Ziel des Projekts.

## 2.6.0

### Changed
- **Kartenanbieter-Abstraktion**: Der Satellitenbild-Hintergrund läuft jetzt über eine
  generische Provider-Registry (`map_provider_id`-Spalte statt Boolean-Flag) statt
  verstreuter Esri/OSM-Ternaries — Grundlage für weitere Kartenanbieter.
- **RLP-DOP20 statt Esri World Imagery**: Der Luftbild-Hintergrund nutzt jetzt
  ausschließlich den amtlichen WMS-Dienst RLP-DOP20; Esri wurde vollständig entfernt
  (Esri erlaubte den kostenlosen Zugriff nur für "Noncommercial Use").

### Security
- Export-Proxy für den WMS-Kartenhintergrund gehärtet, Gast-Export-Fetch abgesichert,
  `save_track`-Rechte in einer zweiten Review-Runde nachgeschärft.

### Fixed
- **Bibliotheks-Formationen**: "Meine Hindernisse" zeigte durch einen fehlenden
  Owner-Filter fälschlich auch fremde, in die Bibliothek aufgenommene Formationen an;
  das Öffnen einer solchen Formation scheiterte gleichzeitig mit "Kein Zugriff", weil
  die Berechtigungs-RPC die Bibliotheks-Mitgliedschaft nicht kannte. Behoben:
  `fetchCustomFormations` filtert jetzt nach `owner_id`; `get_my_formation_permission`
  und `duplicate_custom_formation` kennen `is_library=true` jetzt als Read-only-Zugriff
  für alle eingeloggten Nutzer (Admins behalten vollen Bearbeitungszugriff auf jede
  fremde Formation).
- Export: Raster in SVG/PDF gedämpft dargestellt, bei PNG-Export vollständig entfernt
  statt nur den weißen Hintergrund wegzulassen.
- Lokaler OTP-Login-Flow im Dev-Setup vollständig repariert.

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
