# ADR 0001: Self-hosted Supabase statt Supabase Cloud

Status: Angenommen (2026-07-05)

## Entscheidung

Produktion läuft nicht mehr gegen ein Supabase-Cloud-Projekt, sondern gegen
den self-hosted Supabase-Docker-Stack (`docker/supabase/docker-compose.yml`),
betrieben auf eigener Hardware am Wohnsitz des Betreibers (Deutschland),
erreichbar über einen Cloudflare-Zero-Trust-Tunnel und einen vorhandenen,
selbst containerisierten nginx-Reverse-Proxy (beides außerhalb dieses
Repos). `docker/docker-compose.yml` bindet den Stack per `include` ein
(Projekt `kartslalom-prod`, kein separates Prod-Compose-File).

## Motivation

- Laufende Abhängigkeit von und Kosten für ein gehostetes Supabase-Cloud-
  Projekt sollten entfallen.
- Der self-hosted Stack existierte für lokale Entwicklung bereits
  vollständig und war architektonisch bereits darauf vorbereitet (dynamische
  Auth-Redirects über `window.location.origin`, kein Storage-/Edge-Function-
  Code mit Cloud-spezifischen Annahmen) — die Produktivsetzung war primär
  ein Infrastruktur-, kein Anwendungsumbau.
- Es gab noch keine echten Nutzerdaten in der Cloud-Instanz, wodurch eine
  Datenmigration entfiel und der Umstieg risikoarm möglich war.

## Alternativen

- **Supabase Cloud beibehalten:** verworfen, das war der Auslöser der
  Entscheidung.
- **Anderer BaaS-Anbieter (Firebase, Appwrite, PocketBase, ...):** nicht in
  Betracht gezogen, da die komplette Architektur (RLS, RPCs, PostgREST,
  GoTrue) bereits auf Supabase aufbaut und der self-hosted Stack schon
  vorhanden war.
- **Vollständig eigenes Backend ohne Supabase-Software (BFF, eigene Auth):**
  deutlich größerer Umbau, betrifft jede RPC/RLS/API-Schicht — bewusst NICHT
  gewählt, siehe "Zukünftige Richtung" unten.

## Auswirkungen

- Frontend/Anwendungscode praktisch unverändert: weiterhin `@supabase/
  supabase-js`, gleiche RPCs, gleiche RLS-Policies, gleiche Migrationen.
- Neue Kopplung an: konkrete Supabase-Docker-Images (bewusst gepinnt, keine
  `latest`-Tags), Kong-Routing, das eigene Netzwerk-Setup (Cloudflare Zero
  Trust + externer, containerisierter nginx-Proxy).
- `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` werden bei jedem Domain-/Key-
  Wechsel neu ins Docker-Image gebacken (Vite Build-Args, keine
  Laufzeit-Konfiguration) — Rebuild statt Restart nötig.
- Reverse-Proxy/TLS werden bewusst NICHT in diesem Repo verwaltet, sondern
  über ein gemeinsames externes Docker-Netzwerk (`kartslalom-edge`) an die
  vorhandene, repo-externe Proxy-Infrastruktur angebunden (Kong/App-Ports
  sind nur noch auf `127.0.0.1` des Docker-Hosts gebunden, nicht mehr auf
  allen Interfaces).

## Betriebsverantwortung

Vorher lag ein großer Teil des Betriebsrisikos (Updates, Backups, Uptime,
Skalierung) bei Supabase Cloud. Jetzt liegt es vollständig beim Betreiber:

- **Updates:** Images sind konkret gepinnt (z. B. `supabase/gotrue:v2.189.0`,
  `supabase/postgres:15.8.1.085`) für Reproduzierbarkeit — Updates sind ein
  bewusster, manueller Schritt (Versionsnummer ändern, Changelog prüfen,
  vorher Backup, danach Integrationstests).
- **Backup:** `docker/supabase/backup.sh` (pg_dump + Storage-Archiv, 14-Tage-
  Rotation, lokal unter `docker/supabase/backups/`, gitignored). Kein
  Offsite-Sync automatisiert — offener Punkt, siehe unten.
- **Monitoring/Logs:** Alle Compose-Services haben Log-Rotation
  (`json-file`, 10 MB × 5 Dateien) gegen unbegrenztes Log-Wachstum. Aktives
  Monitoring (Container-Health, Disk, Auth-Fehlerraten) ist noch nicht
  eingerichtet — offener Punkt.
- **Security:** Secrets werden per `utils/generate-keys.sh` generiert und
  vor Start per `docker/supabase/preflight-check.sh` gegen bekannte Demo-
  Werte geprüft. `FUNCTIONS_VERIFY_JWT` bleibt bewusst `false` (siehe Code-
  Kommentar bei `functions` in `docker/supabase/docker-compose.yml`): die
  vier Edge Functions prüfen Auth selbst (drei per Supabase-Auth-`getUser`,
  `user-lifecycle` per eigenem `CRON_SECRET`-Header) — ein globales
  `VERIFY_JWT=true` würde den Cron-Aufruf von `user-lifecycle` mit 401
  blockieren, da es keine Pro-Function-Konfiguration im self-hosted Edge
  Runtime gibt.

## Offene Punkte (bewusst nicht Teil dieses Umbaus)

- Offsite-Backup (verschlüsselt, z. B. `rclone`/`restic` auf ein externes
  Ziel) und ein regelmäßiger, tatsächlich durchgeführter Restore-Test.
- Aktives Monitoring/Alerting (Container-Zustände, Disk, Auth-Fehler,
  Zertifikats-/Tunnel-Ablauf).
- Einheitliches Migrations-Tracking: aktuell zwei Wege (`migrate.sh` für die
  Erstinstallation, `apply-migrations.sh` mit einer manuell gepflegten
  `LEGACY`-Liste für alles danach) — funktioniert, wird aber mit jeder
  weiteren Migration wartungsanfälliger.

## Zukünftige Richtung

Der App-Server soll langfristig als Backend-for-Frontend (BFF) alle
Supabase-Requests entgegennehmen und intern weiterreichen, sodass der
Browser nicht mehr direkt mit Kong spricht — dann entfällt die aktuell
öffentlich (über den Reverse-Proxy) geroutete `api.kart.cheezuscraizt.de`
wieder. Das ist ein eigener, größerer Umbau und nicht Teil dieser
Entscheidung.
