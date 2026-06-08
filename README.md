# Kartslalom Streckenplaner

Clientseitige Single-Page-Anwendung zum Entwerfen, Validieren und Exportieren
von Kartslalom-Strecken (Pylonen-Formationen auf einer rechteckigen Fläche,
optional über einem Kartenausschnitt).

Es gibt **keinen Backend-Anteil**: Alle Daten liegen ausschließlich im
`localStorage` des Browsers (Autosave) bzw. werden als Datei
(JSON/SVG/PDF) exportiert/importiert.

> Eine Anleitung für **Endnutzer:innen** befindet sich direkt in der App
> (Hilfe-Button in der Werkzeugleiste). Die hier verlinkte Dokumentation
> richtet sich an Entwickler:innen.

## Tech-Stack

```yaml
frontend:
  framework:  React 18 + TypeScript
  bundler:    Vite 5
  icons:      lucide-react
  animation:  framer-motion (installiert, kaum genutzt)
  karten:     OpenStreetMap-Tiles (statische <img>-Tags, kein Kartenframework)
  deployment: Docker (Multi-Stage-Build) + nginx

backend:
  typ:      keiner
  speicher: localStorage (Browser, debounced Autosave)
  auth:     keine
  api:      keine
```

## Entwicklung

```bash
npm install
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
| Persistenz (Autosave, JSON-Import/-Export) | [docs/persistenz.md](docs/persistenz.md) |
| Export (SVG/PDF) | [docs/export.md](docs/export.md) |
| Bedienung (responsives Layout, Tastaturkürzel) | [docs/bedienung.md](docs/bedienung.md) |
| Build & Deployment (Docker, nginx) | [docs/build-und-deployment.md](docs/build-und-deployment.md) |

## Geplante Weiterentwicklung

[docs/planning/SAAS_PLAN.md](docs/planning/SAAS_PLAN.md) und
[docs/planning/IMPLEMENTATION_PLAN.md](docs/planning/IMPLEMENTATION_PLAN.md)
beschreiben die geplante Transformation des aktuellen MVP (rein clientseitig,
ohne Backend) in eine SaaS-Anwendung mit Login, Cloud-Speicherung und
Bezahlfunktionen (Supabase, Stripe, Resend, Hetzner/Coolify). Der aktuelle
Stand entspricht „PHASE 0 / IST-Analyse“ in jenen Dokumenten.

## Lizenz

Proprietär — alle Rechte vorbehalten, siehe [LICENSE](LICENSE).
