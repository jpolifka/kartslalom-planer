# Architektur

Überblick über Aufbau, Schichten und Datenfluss der App. Details zu einzelnen
Bereichen stehen in den benachbarten Dokumenten (siehe
[README](../README.md#architektur--konzepte)).

## Überblick

Single-Page-App (React 18 + TypeScript, Vite, React Router 7) mit self-hosted
Supabase als Backend (PostgreSQL + RLS, PostgREST, Auth, Edge Functions hinter
Kong). Es gibt keinen eigenen App-Server: der Browser spricht direkt mit
Kong/Supabase, das Frontend wird als statisches Bundle über nginx ausgeliefert.

Zwei Betriebsarten prägen die ganze Anwendung:

- **Gast-Modus** (keine Session): Editor und Formation-Editor funktionieren
  vollständig im Browser, Zustand liegt in `localStorage` (`lib/storage.ts`).
  Es gibt keinen Tarif, alle Editor-Funktionen sind frei.
- **Cloud-Modus** (Session): Strecken und Formationen werden über
  SECURITY-DEFINER-RPCs in Supabase gespeichert; Tarif-Limits und
  Berechtigungen werden serverseitig erzwungen.

Nach dem ersten Login übernimmt `AuthCallbackPage` einen vorhandenen
Gast-Stand einmalig als Cloud-Strecke (siehe [persistenz.md](persistenz.md)).

## Projektstruktur

```
src/
├── main.tsx                 Bootstrap: BrowserRouter + QueryClientProvider (staleTime 30 s),
│                            hält den Auth-Store per getSession()/onAuthStateChange aktuell
├── router.tsx               Routendefinition in drei Zugriffszonen (siehe unten)
├── types.ts                 Zentrale Domänentypen (Formationen, Cones, Pfeile, Kategorien)
├── pages/                   Eine Datei je Route
│   ├── EditorPage.tsx        Streckeneditor (State, Autosave, Gast/Cloud/Vorschau/Admin-Modus)
│   ├── editor/               Zerlegung des Editors: trackReducer.ts, components/ (Header,
│   │                         LeftSidebar, Toolbar, RightPanel, PaletteCard, …), hooks/
│   ├── FormationEditorPage.tsx   Editor für eigene Formationen ("Hindernis-Editor")
│   ├── FormationsPage.tsx    Eigene, geteilte und Bibliotheks-Formationen
│   ├── FormationSharePage.tsx    Freigaben einer Formation verwalten
│   ├── DashboardPage.tsx     Eigene Strecken (Anlegen, Umbenennen, Löschen, Versionen)
│   ├── SharedTrackPage.tsx   Öffentliche Nur-Lese-Ansicht (/share/:token)
│   ├── SettingsPage.tsx      Konto, DSGVO-Export, Account löschen
│   ├── Login/AuthCallbackPage.tsx    Magic-Link-Login (PKCE), Gast-Migration, Willkommens-Mail
│   ├── Admin{Dash,Formations,Tracks}Page.tsx   Moderation (nur Admin)
│   └── ImpressumPage.tsx     Impressum + Datenschutz
├── components/
│   ├── TrackCanvas.tsx       SVG-Zeichenfläche der Strecke (Drag & Drop, Auswahl, Pfeile)
│   ├── MapBackground.tsx     Kartenhintergrund im Editor
│   ├── MapSelector.tsx       Modal: Kartenausschnitt wählen/drehen (Rechteck oder Polygon)
│   ├── FormationThumbnail.tsx    SVG-Vorschau einer Formation (Palette)
│   ├── SaveAsDialog / FeedbackDialog / ImprintContent
│   ├── auth/                 AuthGuard, AdminGuard
│   ├── layout/               GlobalLayout (Rahmen für ALLE Routen), GlobalNav
│   ├── formation-editor/     Canvas, Meta-Panel, Basis-Auswahl des Formation-Editors
│   └── help/                 HelpModal + Markdown-Rendering der Nutzerdoku (docs/user/)
├── store/authStore.ts       Zustand: Session, Profil, isLoading
├── hooks/                   React-Query-Fassaden und UI-Hooks (siehe Schichtenmodell)
├── lib/
│   ├── supabase.ts           Supabase-Client (PKCE-Flow)
│   ├── api/                  RPC-/Query-Zugriff: tracks.ts, customFormations.ts
│   ├── formationRegistry.ts  Zentrales Register der eingebauten Formationen + Dauern
│   ├── formations/           Geometrie je eingebauter Formation + Editor-Hilfen
│   │                         (permission.ts, formationEditorUtils.ts, saveErrorMessage.ts)
│   ├── validation/           Regelprüfung: geometry.ts (pro Formation), track.ts (Fahrfluss)
│   ├── mapProviders.ts       Registry der Kartenanbieter (OSM, RLP-DOP20)
│   ├── mapRender.ts          Gemeinsame Layout-Berechnung Kartenhintergrund (Editor + Export)
│   ├── geo.ts / areaSelection.ts / geometry.ts   Geokoordinaten, Kartenausschnitt, Cone-Geometrie
│   ├── exportSVG.ts          SVG-Generierung, SVG-Download, PDF-Export
│   └── storage.ts            localStorage-Autosave, JSON-Export/-Import, Migration alter Saves
├── features/                Feature-Slices (api/hooks/components/types je Feature)
│   ├── png-export/           PNG-Export (rendert das SVG aus exportSVG.ts)
│   └── track-share/          Öffentliche Share-Links (Dialog, anonymer Abruf)
├── functions/               Unit-Tests der Edge-Function-Handler (Code liegt in supabase/functions/)
└── __integration__/         Integrationstests gegen echte Supabase-Instanz

supabase/
├── migrations/              Einzige Schemaquelle (YYYYMMDDHHMMSS_beschreibung.sql)
└── functions/               Edge Functions (Deno): main (Dispatcher), account-export,
                             delete-account, send-welcome, user-lifecycle, map-background-image
```

## Schichtenmodell und Architekturregeln

```
UI (pages/, components/)  →  Hook (hooks/)  →  API-Modul (lib/api/, features/*/api/)  →  Supabase (RPC)
```

- **Keine Supabase-Aufrufe in Pages/Komponenten.** UI spricht nur mit Hooks; Hooks
  (React Query) verwalten Cache und Invalidierung; API-Module kapseln RPC-Aufrufe
  und mappen Fehler.
- **Pages transformieren keine DB-Zeilen fachlich** — dafür gibt es Mapper-Funktionen
  oder Hooks. Domänenmodelle (`types.ts`, `SavedState`) bleiben unabhängig von
  Supabase-Typen.
- **Schreiben nur über SECURITY-DEFINER-RPCs**, kein `.insert()`/`.update()` vom
  Client. Lesen über RLS-geschützte Tabellenabfragen mit **expliziten Spaltenlisten**
  (nie `select("*")`).
- **Neue, abgrenzbare Features** entstehen als Slice unter `src/features/<name>/`
  (api, hooks, components, types, Tests). Bestehender Code bleibt bewusst nach
  Schichten organisiert.
- **Fehler** aus RPCs werden in der API-Schicht aus der Postgres-Fehlermeldung auf
  String-Codes gemappt (z. B. `TRACK_LIMIT_REACHED`, `MAP_PROVIDER_REQUIRES_PRO`).

Vollständige Verhaltensregeln für Beiträge stehen in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Routing und Zugriffszonen

Alle Routen hängen unter `GlobalLayout` (Navigation, Hilfe, lädt das Profil via
`useProfile`). Der Router rendert erst, wenn `main.tsx` die initiale Session
geladen hat (`isLoading`), damit Guards nicht fälschlich umleiten.

| Zone | Routen | Guard |
| --- | --- | --- |
| Öffentlich | `/login`, `/auth/callback`, `/editor/new`, `/editor/:trackId`, `/formations/new`, `/formations/:id`, `/share/:token`, `/impressum` | keiner — Editoren nutzen im Gast-Modus `localStorage` |
| Angemeldet | `/` (→ `/dashboard`), `/dashboard`, `/formations`, `/formations/:id/share`, `/settings` | `AuthGuard` (Redirect nach `/login`) |
| Admin | `/admin`, `/admin/formations`, `/admin/tracks` | `AdminGuard` |

`/datenschutz` leitet auf `/impressum#datenschutz` um; unbekannte Pfade landen im
Editor (`/editor/new`). `AdminGuard` fragt die Admin-Rolle **serverseitig** per RPC
(`is_current_user_admin`) ab, statt dem Client-State zu vertrauen.

## Auth und Profil

Login ist Magic-Link (Supabase Auth, PKCE). `useAuthStore` (Zustand) hält Session,
Profil und `isLoading`; der Store abonniert selbst nichts — `main.tsx` hält ihn per
`getSession()` und `onAuthStateChange()` synchron und löscht das Profil bei Logout.
Das Profil (`profiles`: Tarif, Rolle) wird getrennt per `useProfile()` nachgeladen
und in den Store gespiegelt. Nach dem ersten Login ruft `AuthCallbackPage` die Edge
Function `send-welcome` auf (idempotent, die Function entscheidet über den Versand).

## Tarife

Drei Tarife: `free`, `pro`, `team`. Zwei rein clientseitige UX-Mechanismen:

- `useTier`: fest einkompilierte Limits (Strecken: 3 / 50 / unbegrenzt) und
  Feature-Flags (Premium-Kartenanbieter, Polygon-Ausschnitt, Share-Links,
  Versionshistorie, PNG-Export — für `free` gesperrt).
- `useFeatureGate`: der nötige Tarif für ein Feature steht in `app_config`
  (serverseitig änderbar, ohne Deploy), aktuell für eigene Formationen
  (`custom_formations_required_tier`).

**Enforcement geschieht ausschließlich serverseitig** (RPCs/RLS). Tarif-Sperren im
Client gelten nur im Cloud-Modus; im Gast-Modus gibt es keinen Tarif. Tier-Upgrades
erfolgen manuell per SQL (kein Checkout in der App).

## Track-Editor

`EditorPage` ist der zentrale Streckeneditor und unterscheidet vier Situationen:

- **Gast**: State aus `localStorage` (`loadState()` einmalig beim Modulstart),
  Autosave debounced (1 s) zurück nach `localStorage`.
- **Cloud**: Strecke per `useTrack` laden, Autosave über `save_track()`. `/editor/new`
  legt sofort per `create_track()` eine Strecke an und leitet auf `/editor/:id` um.
- **Versionsvorschau** (`?previewVersion=<id>`): historischer Snapshot, Autosave aus.
- **Admin auf fremder Strecke**: RLS liefert keine Zeile, Fallback über die RPC
  `admin_get_track` (nur lesend).

### Undo/Redo

Der Streckenzustand (`TrackState = { items, arrows }`) liegt in einem History-Objekt
`{ past, present, future }` (max. 30 Schritte), Reducer in
[`pages/editor/trackReducer.ts`](../src/pages/editor/trackReducer.ts). Es gibt zwei
Aktionsklassen:

- **committing** (`ADD_*`, `DELETE_*`, `UPDATE_FORMATION`, …): schreiben `present` in
  `past` und leeren `future`.
- **live** (`MOVE_FORMATION(S)`, `MOVE_ARROW_CP`, `MOVE_ARROW_ENDPOINT`): ändern nur
  `present`, damit ein Drag nicht pro Frame einen Undo-Schritt erzeugt. Ein
  `CHECKPOINT` bei Drag-Start sichert den Vorzustand.

Der Formation-Editor nutzt dieselbe Strategie in `hooks/useFormationEditor.ts`.

### Datenmodell im Frontend ([types.ts](../src/types.ts))

- `FormationDefinition`: statische Beschreibung (Label, Cones, optionaler Pfeil,
  Standarddauer, Kategorie). `FormationKey` enthält die eingebauten Schlüssel und `"custom"`.
- `PlacedFormation`: Instanz auf der Fläche (`id`, `key`, `x`/`y` in **Metern**,
  `rotationDeg`, `direction`, optionales `durationSeconds`-Override). Bei eigenen
  Formationen trägt sie zusätzlich `customFormationId` und einen **eingefrorenen
  `customSnapshot`** (Cones/Pfeile/Label): die Strecke referenziert die Quell-Formation
  nicht live, spätere Änderungen oder Löschungen wirken sich nicht auf sie aus.
- `PlacedArrow`: frei gezeichneter Bézier-Pfeil (Start/Ende + Kontrollpunkt).
- `ConePoint`: einzelne Pylone (`kind: standing | lying | sensor`, optionale
  `role`/`angleDeg`).
- `SavedState` (`lib/storage.ts`): gemeinsame Persistenzform für localStorage,
  JSON-Export/-Import und die Cloud-Speicherung.

## Formationen

**Eingebaute Formationen** sind statisch: eine Datei je Formation in
`lib/formations/` (Cone-Geometrie), registriert in `lib/formationRegistry.ts` (dort
auch die Dauern-Overrides).

**Eigene Formationen** (`custom_formations`) entstehen im Formation-Editor
(`/formations/*`), optional auf Basis einer eingebauten Formation (`BasisAuswahl`).
Lebenszyklus (`status`): `private` → optional `shared` (gezielte Freigabe an einzelne
Nutzer mit `view`/`edit`, Tabelle `formation_shares`) → `submitted` (zur öffentlichen
Bibliothek eingereicht) → vom Admin zu `library` (erzeugt eine Kopie mit
`is_library = true`) oder `rejected`. Statuswechsel passieren in den jeweiligen RPCs.
Bibliotheks-Formationen sind auch ohne Login lesbar (`get_library_formations`).

Die Zugriffslogik im Client ([`lib/formations/permission.ts`](../src/lib/formations/permission.ts))
folgt der Hierarchie `null < view < edit < owner`; Admins haben auf fremde Formationen
effektiv `edit` und schreiben über eigene `admin_*`-RPCs. Zugriff und Grenzen
(z. B. Cone-Limit) erzwingt der Server.

## Validierung

`lib/validation/` prüft Regelverstöße rein clientseitig und ohne Seiteneffekte
(`runValidation`): `geometry.ts` betrachtet einzelne Formationen (Fläche, überlappende
Pylonen), `track.ts` rekonstruiert einen angenommenen Fahrfluss und prüft
Streckenregeln (Vorstartbereich, Wechselzone, getrennte Bereiche, Abstände). Siehe
[validierung.md](validierung.md).

## Karte und Export

- **Anbieter** stehen in `lib/mapProviders.ts`: `osm` (XYZ-Kacheln) und `rlp_dop20`
  (WMS-Einzelbild, Luftbild Rheinland-Pfalz). Die Strecke speichert nur die
  `map_provider_id`. Außerhalb der Abdeckung eines Anbieters fällt das **Rendering**
  auf OSM zurück, die gespeicherte Auswahl bleibt unverändert. Premium-Anbieter sind
  tarifgesperrt (`MAP_PROVIDER_REQUIRES_PRO` vom Server).
- **Kartenausschnitt** (`AreaSelection`, `lib/areaSelection.ts`): rotierbares Rechteck
  oder Polygon; die **effektive Feldgröße** kommt aus dem Ausschnitt, nicht aus
  `manual_width`/`manual_length` (die gelten nur ohne Ausschnitt).
- **Rendering** des Hintergrunds teilen sich Editor (`MapBackground`) und Export über
  `lib/mapRender.ts`.
- **Export**: SVG/PDF in `lib/exportSVG.ts`, PNG in `features/png-export`. Für
  WMS-Hintergründe im Export ruft der Client die Edge Function `map-background-image`
  (Allowlist-Proxy, nimmt nur Anbieter-ID + BBox entgegen) statt den Dienst direkt.
  Alle Texte im SVG werden escaped. Details: [export.md](export.md),
  [kartenintegration.md](kartenintegration.md).

## Backend

### Datenbank

Tabellen: `profiles` (Tarif, Rolle, Lifecycle-Felder), `tracks`, `track_versions`
(Snapshots je Speicherstand), `custom_formations`, `formation_shares`, `app_config`.
RLS ist auf allen Tabellen aktiv; Tabellen mit Tarif-/Limitlogik sind für
`anon`/`authenticated` nicht direkt beschreibbar. Öffentlich ausführbar sind nur
`get_library_formations` und `get_track_by_share_token`.

RPC-Familien (Auswahl): Strecken (`create_track`, `save_track`, `rename_track`,
Versionen, Share-Links), Formationen (`create/update/delete/duplicate_custom_formation`,
Sharing, Berechtigungsabfrage), Admin (`admin_*`).

Migrationen liegen in `supabase/migrations/` und sind die einzige Schemaquelle;
Anwenden und Testen siehe [build-und-deployment.md](build-und-deployment.md) und
[CONTRIBUTING.md](../CONTRIBUTING.md).

### Edge Functions

Kong routet `/functions/v1/*` vollständig an `supabase/functions/main/index.ts`, einen
Dispatcher. Jede Function besteht aus `handler.ts` (Logik, einzige Quelle der
Wahrheit) und `index.ts` (dünner `Deno.serve`-Entrypoint); `main` importiert die
Handler direkt.

| Function | Aufgabe |
| --- | --- |
| `account-export` | DSGVO-Datenexport des eingeloggten Nutzers |
| `delete-account` | Account-Löschung (ruft `delete_account_data()`-RPC mit User-Token) |
| `send-welcome` | Willkommens-Mail nach erstem Login (idempotent) |
| `user-lifecycle` | Cron: Inaktivitäts-Erinnerungen und Soft-Delete (`x-cron-secret`) |
| `map-background-image` | Proxy für WMS-Kartenhintergründe im Export |

## Nutzerhilfe

Die Endnutzer-Hilfe besteht aus Markdown-Dateien in `docs/user/` (und
`docs/user/formation-editor/`), die per Vite `?raw`-Import gebündelt und von
`components/help/` gerendert werden — die Dateien sind Teil des Produkts, keine
reine Entwicklerdoku.

## Tests

| Ebene | Ort | Ausführung |
| --- | --- | --- |
| Unit (Vitest, jsdom) | `src/**/*.test.ts(x)`, Edge-Function-Handler in `src/functions/` | `docker compose -f docker/docker-compose.unit.yml up --build --exit-code-from unit-test` |
| Integration (echte DB) | `src/__integration__/` | `sh docker/run-integration-test-local.sh` |
| Security-Smoke (RLS/GRANT/Tier) | `scripts/security-smoke-test.ts` | `sh docker/run-security-test-local.sh` |
| E2E (Playwright, Chromium) | `e2e/` | `sh docker/run-playwright-local.sh` |

Pages, Canvas-/Map-Komponenten und Auth-Hooks sind von der Unit-Coverage
ausgenommen (Abdeckung über Playwright). Schwellen: 80 % Statements/Functions/Lines,
70 % Branches.
