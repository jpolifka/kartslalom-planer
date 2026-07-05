# Build & Deployment

## Lokale Dev-Umgebung (App + Supabase)

Die App und der lokale Supabase-Stack laufen als **ein** Docker-Compose-Projekt
(`kartslalom`): [`docker/docker-compose.dev.yml`](../docker/docker-compose.dev.yml)
bindet per `include` den self-hosted Supabase-Stack aus
[`docker/supabase/docker-compose.yml`](../docker/supabase/docker-compose.yml)
ein (Postgres, Auth, PostgREST, Realtime, Storage, Studio, Kong, Supavisor,
Mailpit) und startet zusaetzlich den Vite-Dev-Container.

```bash
docker compose --profile dev -f docker/docker-compose.dev.yml up -d   # alles starten (App + Supabase, inkl. Mailpit)
docker compose --profile dev -f docker/docker-compose.dev.yml down    # alles stoppen (Daten bleiben erhalten)
cd docker/supabase && sh reset.sh                        # nur Supabase: Daten loeschen, Schema neu anlegen
```

> `--profile dev` aktiviert den Mailpit-Mailcatcher (siehe
> [`docker/supabase/docker-compose.yml`](../docker/supabase/docker-compose.yml)).
> Ohne dieses Flag startet Mailpit nicht — genau das nutzt die Produktion
> (`docker/docker-compose.yml`, siehe unten) aus: sie bindet denselben
> Supabase-Stack ein, aber ohne `dev`-Profil und mit echtem SMTP statt Mailpit.

- **App (Vite Dev-Server):** http://localhost:5174
- **Studio (Dashboard):** http://localhost:8000 (Login siehe
  `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` in `docker/supabase/.env`)
- **API/Kong:** http://localhost:8000
- **Postgres (via Supavisor):** `localhost:54322`
- **Mailpit (Magic-Link-Mails abfangen):** http://localhost:8025

`docker/supabase/.env` enthaelt generierte Secrets fuer die lokale
Entwicklung (gitignored, wird ueber `include: ... env_file:` eingebunden).
`docker/supabase/.env.example` zeigt die Vorlage von Supabase.
`ENABLE_EMAIL_AUTOCONFIRM=true` und `SMTP_HOST=mailpit` sind fuer lokale
Entwicklung vorkonfiguriert — Magic-Link-Mails landen in Mailpit statt an
eine echte Adresse.

Das App-Schema (Phase 0.5–0.7: `profiles`, `tracks`, `track_versions`, RLS,
`create_track()`, `save_track()`, `touch_last_active()`) wird beim ersten
Start automatisch ueber Init-Skripte in
[`docker/supabase/volumes/db/init/`](../docker/supabase/volumes/db/init/)
angelegt. Diese laufen nur bei **leerem** Datenverzeichnis
(`docker/supabase/volumes/db/data/`) — fuer Schemaaenderungen entweder
`sh reset.sh` (Daten weg) oder die SQL manuell ueber Studio/`psql` nachziehen.

`.env.local` im Projekt-Root verweist die App auf die lokale Instanz (Browser
greift direkt auf den per Kong veroeffentlichten Port zu, daher `localhost`
statt Servicename):

```
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=<ANON_KEY aus docker/supabase/.env>
```

## Entwicklung

```bash
npm run dev          # Vite-Dev-Server mit HMR (lokal, ohne Docker)
npm run type-check   # tsc --noEmit
```

Für eine containerisierte Dev-Umgebung mit Hot-Module-Replacement
(startet App **und** lokales Supabase, s. o.):

```bash
docker compose --profile dev -f docker/docker-compose.dev.yml up
```

Siehe [`docker/Dockerfile.dev`](../docker/Dockerfile.dev) /
[`docker/docker-compose.dev.yml`](../docker/docker-compose.dev.yml)
(Bind-Mount des Projektverzeichnisses, `CHOKIDAR_USEPOLLING` für
zuverlässiges File-Watching in Containern; `context: ..` zeigt auf das
Projekt-Wurzelverzeichnis, da die Compose-/Docker-Dateien in `docker/` liegen).

> **Hinweis zu `.dockerignore`:** Die Datei liegt bewusst im
> Projekt-Wurzelverzeichnis (`.dockerignore`, nicht in `docker/`) — Docker
> sucht sie ausschließlich im Build-Context-Root. Da `context: ..` auf das
> Projekt-Wurzelverzeichnis zeigt, muss `.dockerignore` dort liegen, damit
> z. B. `node_modules` beim Build nicht mit übertragen wird.

## Produktions-Build

```bash
npm run build        # tsc --noEmit && vite build
npm run preview      # lokale Vorschau des Builds
```

`npm run build` führt zunächst die TypeScript-Typprüfung aus und bricht bei
Typfehlern ab, bevor `vite build` den eigentlichen Produktions-Bundle erzeugt.

## Produktions-Deployment (self-hosted, ohne Supabase Cloud)

Produktion läuft auf dem **gleichen self-hosted Supabase-Stack** wie die
lokale Entwicklung (`docker/supabase/docker-compose.yml`), nur ohne
Dev-Profil (kein Mailpit) und mit echten Secrets/SMTP. Es gibt **keine**
Abhängigkeit mehr von Supabase Cloud.

> **Extern zu konfigurieren (nicht Teil dieses Repos):** Der Docker-Host
> liegt hinter Cloudflare Zero Trust (`cloudflared`-Tunnel) und einem
> vorhandenen nginx-Reverse-Proxy, die Subdomains trennen. TLS-Terminierung
> und Routing passieren dort, nicht in diesem Repo — well-known Ports
> (80/443) sind für die Compose-Services hier nicht verfügbar. Folgende zwei
> Ziele müssen dort ergänzt werden, bevor die App/API von außen erreichbar
> sind:
>
> | Hostname | Ziel (Docker-Host) |
> | --- | --- |
> | `kart.cheezuscraizt.de` | Port `5173` (App-Container, `kartslalom`) |
> | `api.kart.cheezuscraizt.de` | Port `8000` (Kong) |
>
> `api.kart.cheezuscraizt.de` ist eine **Übergangslösung**: der Browser
> spricht damit direkt mit Kong/Supabase (REST/Auth/Realtime/Storage/
> Functions). Langfristig soll der App-Server stattdessen als
> Backend-for-Frontend (BFF) alle Requests entgegennehmen und intern an Kong
> weiterreichen — dann entfällt diese Subdomain wieder. Das ist ein eigener,
> größerer Umbau und **nicht** Teil dieses Deployments.

### 1. Secrets generieren

```bash
cd docker/supabase
cp .env.example .env
sh utils/generate-keys.sh --update-env   # ersetzt Demo-Keys/Passwörter in .env
```

Danach in `docker/supabase/.env` von Hand setzen (siehe Kommentare in
`.env.example`):

- `ENABLE_EMAIL_AUTOCONFIRM=false` (Dev-Default `true` **muss** in Produktion
  aus sein, sonst ist Signup ohne E-Mail-Bestätigung möglich)
- `SITE_URL=https://kart.cheezuscraizt.de`,
  `API_EXTERNAL_URL=https://api.kart.cheezuscraizt.de`,
  `ADDITIONAL_REDIRECT_URLS=https://kart.cheezuscraizt.de/auth/callback`
- `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_USER=resend`,
  `SMTP_PASS=<RESEND_API_KEY>` (gleicher Resend-Account wie für die
  Welcome-/Lifecycle-Mails der Edge Functions), `SMTP_ADMIN_EMAIL`/
  `SMTP_SENDER_NAME` auf die echte Absenderadresse

### 2. App-Build auf die Prod-Domain

Root-`.env` (gitignored, auf dem Docker-Host):

```
VITE_SUPABASE_URL=https://api.kart.cheezuscraizt.de
VITE_SUPABASE_ANON_KEY=<ANON_KEY aus docker/supabase/.env>
```

**Wichtig:** Vite backt diese Werte zur **Build-Zeit** in das Bundle ein
(`docker/Dockerfile` Build-Args) — es gibt keine Laufzeit-Konfiguration.
Ändert sich Domain oder Key, reicht kein Container-Restart, es braucht einen
Rebuild (Schritt 4).

### 3. Stack starten

[`docker/docker-compose.yml`](../docker/docker-compose.yml) bindet den
Supabase-Stack per `include` ein (ohne `dev`-Profil, Projektname
`kartslalom-prod`):

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

- **App:** Port `5173`
- **API/Kong:** Port `8000` (Studio/Dashboard ist über denselben Port
  erreichbar — bewusst öffentlich, kein zusätzlicher Zugriffsschutz über
  Kongs Basic-Auth hinaus)
- **Postgres (Supavisor):** Port `${POSTGRES_PORT}` — sollte NICHT über den
  externen Proxy veröffentlicht werden, nur Kong braucht öffentlichen
  Zugriff.

### 4. Migrationen

Erstinstallation (leeres Datenverzeichnis) legt das Schema automatisch über
`docker/supabase/migrate.sh` an. Für alle folgenden Migrationen, direkt auf
dem Docker-Host ausführen:

```bash
cd docker/supabase
sh apply-migrations.sh
```

(`push-to-prod.sh` war für die alte Supabase-Cloud-Anbindung gedacht und wird
nicht mehr gebraucht.)

### 5. Backups

```bash
cd docker/supabase
sh backup.sh
```

Sichert einen `pg_dump` der DB sowie `volumes/storage/` in ein datiertes
Archiv unter `docker/supabase/backups/` (letzte 14 Tage werden behalten,
älter wird automatisch gelöscht). Kein Offsite-Sync eingebaut — als nächsten
Schritt empfiehlt sich `rclone`/`rsync` auf ein externes Ziel. Täglich per
Cron/systemd-Timer einplanen, z. B.:

```
0 3 * * * cd /pfad/zum/repo/docker/supabase && sh backup.sh >> backup.log 2>&1
```

## Alte Referenz: nginx-Konfiguration des App-Containers

[`docker/Dockerfile`](../docker/Dockerfile) beschreibt einen zweistufigen Build:

1. **Builder-Stage** (`node:20-alpine`): Abhängigkeiten installieren
   (`npm ci --ignore-scripts`), `npm run build` ausführen.
2. **Serve-Stage** (`nginx:1.27-alpine`): nur das Build-Ergebnis (`dist/`)
   sowie die nginx-Konfiguration werden in das finale Image übernommen.

[`docker/nginx.conf`](../docker/nginx.conf) konfiguriert:

- **SPA-Routing**: `try_files $uri $uri/ /index.html` — alle Pfade landen auf
  `index.html`, das clientseitige Routing übernimmt React (aktuell gibt es
  noch kein Routing, siehe Hinweis unten).
- **Caching/Kompression**: Gzip für Text-/JSON-/SVG-Inhalte, `Cache-Control: immutable`
  für Assets unter `/assets/` (Vite versieht sie mit Content-Hash).
- **Security-Header**: `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, sowie eine CSP mit
  `connect-src` fest auf `api.kart.cheezuscraizt.de` (REST/Auth/Realtime).
  Ändert sich die API-Domain, muss diese Zeile manuell angepasst und das
  Image neu gebaut werden (statische Datei, kein Templating).

