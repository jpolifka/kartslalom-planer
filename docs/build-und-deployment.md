# Build & Deployment

## Entwicklung

```bash
npm run dev          # Vite-Dev-Server mit HMR
npm run type-check   # tsc --noEmit
```

Für eine containerisierte Dev-Umgebung mit Hot-Module-Replacement:

```bash
docker compose -f docker/docker-compose.dev.yml up
```

Siehe [`docker/Dockerfile.dev`](../docker/Dockerfile.dev) /
[`docker/docker-compose.dev.yml`](../docker/docker-compose.dev.yml)
(Bind-Mount des Projektverzeichnisses, `CHOKIDAR_USEPOLLING` für
zuverlässiges File-Watching in Containern; `context: ..` zeigt auf das
Projekt-Wurzelverzeichnis, da die Compose-/Docker-Dateien in `docker/` liegen).

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

[`nginx.conf`](../nginx.conf) konfiguriert:

- **SPA-Routing**: `try_files $uri $uri/ /index.html` — alle Pfade landen auf
  `index.html`, das clientseitige Routing übernimmt React (aktuell gibt es
  noch kein Routing, siehe Hinweis unten).
- **Caching/Kompression**: Gzip für Text-/JSON-/SVG-Inhalte, `Cache-Control: immutable`
  für Assets unter `/assets/` (Vite versieht sie mit Content-Hash).
- **Security-Header**: `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`.

[`docker-compose.yml`](../docker-compose.yml) startet den Produktions-
Container und mappt Port `5173` (Host) auf `80` (Container).

> **Hinweis:** Die App ist aktuell eine echte Single-Page-Anwendung ohne
> Client-seitiges Routing (kein `react-router` o. Ä., siehe `main.tsx`). Die
> SPA-Routing-Konfiguration in `nginx.conf` ist insofern bereits für eine
> mögliche künftige Einführung von Routen vorbereitet.
