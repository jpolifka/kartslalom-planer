# Build & Deployment

## Lokale Dev-Umgebung (App + Supabase)

Die App und der lokale Supabase-Stack laufen als **ein** Docker-Compose-Projekt
(`kartslalom`): [`docker/docker-compose.dev.yml`](../docker/docker-compose.dev.yml)
bindet per `include` den self-hosted Supabase-Stack aus
[`docker/supabase/docker-compose.yml`](../docker/supabase/docker-compose.yml)
ein (Postgres, Auth, PostgREST, Realtime, Storage, Studio, Kong, Supavisor,
Mailpit) und startet zusaetzlich den Vite-Dev-Container.

```bash
docker compose -f docker/docker-compose.dev.yml up -d   # alles starten (App + Supabase)
docker compose -f docker/docker-compose.dev.yml down    # alles stoppen (Daten bleiben erhalten)
cd docker/supabase && sh reset.sh                        # nur Supabase: Daten loeschen, Schema neu anlegen
```

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
docker compose -f docker/docker-compose.dev.yml up
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

## Produktions-Deployment (Docker + nginx)

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
  `Referrer-Policy`, `Permissions-Policy`.

[`docker/docker-compose.yml`](../docker/docker-compose.yml) startet den
Produktions-Container und mappt Port `5173` (Host) auf `80` (Container):

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

