# Kartslalom Streckenplaner

Web-Applikation zum Entwerfen, Validieren und Exportieren von Kartslalom-Strecken
(Pylonen-Formationen auf einer rechteckigen Fläche, optional über einem Kartenausschnitt).

Unterstützt Offline-Nutzung (localStorage) sowie Cloud-Speicherung mit Account,
Dashboard und Tier-System (Free / Pro).

> Eine Anleitung für **Endnutzer:innen** befindet sich direkt in der App
> (Hilfe-Button in der Werkzeugleiste). Die hier verlinkte Dokumentation
> richtet sich an Entwickler:innen.

## Tech-Stack

```yaml
frontend:
  framework:     React 18 + TypeScript
  bundler:       Vite 5
  routing:       React Router 7
  state:         Zustand (Auth/UI), React Query (Server-State)
  validation:    Zod
  icons:         lucide-react
  karten:        OpenStreetMap- & Esri-Satellite-Tiles
  deployment:    Docker (Multi-Stage-Build) + nginx

backend:
  plattform:     Supabase (self-hosted via Docker oder Supabase Cloud)
  datenbank:     PostgreSQL mit Row-Level Security
  auth:          Supabase Auth (Magic Link)
  api:           PostgREST + RPC-Funktionen
  speicher:      Cloud (Supabase) + localStorage (Fallback / Offline)
  tiers:         Free / Pro (serverseitig enforced via RLS & RPC)
```

## Entwicklung

### Voraussetzungen

- Node.js ≥ 18
- Docker + Docker Compose (für lokalen Supabase-Stack)

### Setup

```bash
# 1. Abhängigkeiten
npm ci

# 2. Lokalen Supabase-Stack starten
cd docker/supabase
cp .env.example .env   # Secrets eintragen
docker compose up -d
cd ../..

# 3. Umgebungsvariablen
cp .env.example .env.local   # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY setzen

# 4. Dev-Server
npm run dev          # Vite-Dev-Server mit HMR
npm run type-check   # tsc --noEmit
npm run build        # Typprüfung + Produktions-Build
```

Für eine containerisierte Dev-Umgebung mit HMR siehe
[docs/build-und-deployment.md](docs/build-und-deployment.md).

## Architektur & Konzepte

| Thema | Doku |
| --- | --- |
| Projektstruktur, State-Management & Datenmodell | [docs/architektur.md](docs/architektur.md) |
| Formationssystem (Pylonen-Layouts, neue Formation hinzufügen) | [docs/formationen.md](docs/formationen.md) |
| Zeichenfläche (Canvas, Drag & Drop, Pfeile) | [docs/zeichenflaeche.md](docs/zeichenflaeche.md) |
| Kartenintegration (OSM-Kacheln, Bereichsauswahl) | [docs/kartenintegration.md](docs/kartenintegration.md) |
| Validierung (Geometrie- & Streckenregeln) | [docs/validierung.md](docs/validierung.md) |
| Persistenz (Autosave, Cloud-Sync, JSON-Import/-Export) | [docs/persistenz.md](docs/persistenz.md) |
| Export (SVG/PDF) | [docs/export.md](docs/export.md) |
| Bedienung (responsives Layout, Tastaturkürzel) | [docs/bedienung.md](docs/bedienung.md) |
| Build & Deployment (Docker, nginx) | [docs/build-und-deployment.md](docs/build-und-deployment.md) |

## Lizenz

Proprietär — alle Rechte vorbehalten, siehe [LICENSE](LICENSE).
