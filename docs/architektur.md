# Architektur

## Projektstruktur

```
src/
├── main.tsx                     React-Bootstrap: BrowserRouter + QueryClientProvider,
│                                 initialisiert Supabase-Session in den Auth-Store
├── router.tsx                    Routendefinition (Login, Auth-Callback, Editor, Dashboard, Settings)
├── types.ts                      Zentrale Datentypen (Formationen, Pfeile, Cones)
├── pages/
│   ├── EditorPage.tsx            Editor: State, Reducer, Layout, Toolbar (ehem. App.tsx)
│   ├── LoginPage.tsx              Magic-Link-Login (E-Mail-Eingabe)
│   ├── AuthCallbackPage.tsx       PKCE-Code-Exchange + localStorage-Migration nach Login
│   ├── DashboardPage.tsx          Liste der eigenen Strecken, Anlegen/Löschen
│   ├── SettingsPage.tsx           Account-Infos, Datenexport (JSON), Account löschen
│   └── ImpressumPage.tsx          Impressum + Datenschutz als eigenständige Route, Hash-Scroll
├── components/
│   ├── auth/AuthGuard.tsx         Redirect zu /login ohne Session
│   ├── layout/AppShell.tsx        Header/Navigation für eingeloggte Routen, lädt Profil
│   ├── ImprintContent.tsx         Impressum + Datenschutzerklärung (Inhaltskomponente, wiederverwendbar)
│   ├── TrackCanvas.tsx           Zeichenfläche: Drag & Drop, Auswahl, Pfeile, Rendering
│   ├── MapBackground.tsx         Rendering der OSM-Kachel(n) hinter der Strecke
│   ├── MapSelector.tsx           Modal zur Auswahl/Drehung des Kartenausschnitts
│   └── FormationThumbnail.tsx    SVG-Vorschau einer Formation (Palette, Submenüs)
├── store/
│   └── authStore.ts              Zustand-Store: Session, Profil, isLoading
├── hooks/
│   ├── useProfile.ts              Lädt `profiles`-Zeile, synchronisiert in den Auth-Store
│   ├── useTracks.ts               TanStack-Query-Hooks für Tracks (Liste/Detail/CRUD via RPC)
│   └── useTier.ts                 UX-Limits je Tarif (kein Enforcement, das passiert serverseitig)
└── lib/
    ├── supabase.ts               Supabase-Client (PKCE-Flow)
    ├── api/tracks.ts             fetchTracks/fetchTrack/createTrack/saveTrack/deleteTrack (RPC-basiert)
    ├── formationRegistry.ts    Zentrales Register aller Formationen + Dauern
    ├── formations/*.ts         Geometrie-Definition je Formation (Cone-Layouts)
    ├── geometry.ts             Hilfsfunktionen für Cone-Koordinaten/Normalisierung
    ├── geo.ts                  Umrechnung Geokoordinaten ↔ Meter
    ├── areaSelection.ts        Typ/Hilfsfunktionen für den Kartenausschnitt
    ├── exportSVG.ts            SVG-Generierung, Download, Druck-als-PDF
    ├── storage.ts              localStorage-Autosave (Gast-Modus), JSON-Export/Import
    └── validation/             Regelprüfung (Geometrie + Strecken-Logik)
```

Detaillierte Beschreibungen der einzelnen Bereiche befinden sich in den
benachbarten Dokumenten dieses Verzeichnisses (siehe [README](../README.md#architektur--konzepte)).

## Routing & Auth

Die App ist seit Phase 1 eine Multi-Page-App via `react-router-dom`
(`src/router.tsx`):

- `/login`, `/auth/callback` — öffentlich, Magic-Link-Anmeldung (PKCE).
- `/editor/new`, `/editor/:trackId` — **ohne** `AuthGuard`, damit der
  Gast-Modus (localStorage, keine Anmeldung nötig) erhalten bleibt.
  `EditorPage` unterscheidet anhand der Session (`useAuthStore`), ob
  Cloud-Save (`save_track()`-RPC) oder `localStorage` verwendet wird.
- `/`, `/dashboard`, `/settings` — hinter `AuthGuard` + `AppShell`
  (Header/Navigation, lädt das Profil über `useProfile`).
- `/impressum` — öffentlich, `ImpressumPage` mit Hash-Scroll-Unterstützung.
- `/datenschutz` — Redirect auf `/impressum#datenschutz`.

`src/main.tsx` initialisiert beim Start `supabase.auth.getSession()` und
abonniert `onAuthStateChange`, um `useAuthStore` (Session, Profil) aktuell
zu halten.

## State-Management & Datenmodell

### Track-State mit Undo/Redo

Der zentrale Streckenzustand (`TrackState = { items, arrows }`) wird über
`useReducer` (siehe `trackReducer` in [EditorPage.tsx](../src/pages/EditorPage.tsx))
verwaltet und in einem History-Objekt `{ past, present, future }` gehalten
(max. 30 Schritte).

Es gibt zwei Arten von Aktionen:

- **„committing“** Aktionen (`ADD_FORMATION`, `DELETE_FORMATION(S)`,
  `UPDATE_FORMATION`, `ADD_ARROW`, `DELETE_ARROW`, …): Sie schreiben den
  bisherigen Zustand in `past` und sind damit über `UNDO`/`REDO` rückgängig
  machbar.
- **„live“** Aktionen (`MOVE_FORMATION(S)`, `MOVE_ARROW_CP`,
  `MOVE_ARROW_ENDPOINT`): Sie aktualisieren `present` ohne History-Eintrag —
  das verhindert, dass jeder einzelne Drag-Frame einen Undo-Schritt erzeugt.
  Ein expliziter `CHECKPOINT` (ausgelöst bei Drag-Start, siehe
  `onFormationDragStart`) sichert den Zustand vor dem Ziehen für Undo.

### Datentypen ([types.ts](../src/types.ts))

- `FormationDefinition`: statische Beschreibung einer Formation (Label,
  Beschreibung, `cones: ConePoint[]`, optionaler Pfeil, Standarddauer, …).
- `PlacedFormation`: Instanz einer Formation auf der Fläche (`id`, `key`,
  `x`/`y` in Metern, `rotationDeg`, `direction`, optionales
  `durationSeconds`-Override).
- `PlacedArrow`: frei gezeichneter Bézier-Pfeil (Start/Ende + Kontrollpunkt).
- `ConePoint`: einzelne Pylone/Markierung (`kind: standing | lying | sensor`,
  optionale `role`/`angleDeg`).
