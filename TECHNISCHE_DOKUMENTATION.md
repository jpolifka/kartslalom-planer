# Technische Dokumentation — Kartslalom Streckenplaner

**Stand:** 2026-06-08
**Version:** 0.2.0

Diese Dokumentation richtet sich an Entwickler:innen, die an diesem Repository
arbeiten. Eine Anleitung für Endnutzer:innen befindet sich direkt in der App
(Hilfe-Button in der Werkzeugleiste).

---

## 1. Überblick

Der Kartslalom Streckenplaner ist eine clientseitige Single-Page-Anwendung zum
Entwerfen, Validieren und Exportieren von Kartslalom-Strecken (Pylonen-
Formationen auf einer rechteckigen Fläche, optional über einem Kartenausschnitt).

Es gibt **keinen Backend-Anteil**: Alle Daten liegen ausschließlich im
`localStorage` des Browsers (Autosave) bzw. werden als Datei (JSON/SVG/PDF)
exportiert/importiert.

```yaml
frontend:
  framework: React 18 + TypeScript
  bundler:   Vite 5
  icons:     lucide-react
  animation: framer-motion (installiert, kaum genutzt)
  karten:    OpenStreetMap-Tiles (statische <img>-Tags, kein Kartenframework)
  deployment: Docker (Multi-Stage-Build) + nginx

backend:
  typ:       keiner
  speicher:  localStorage (Browser, debounced Autosave)
  auth:      keine
  api:       keine
```

## 2. Projektstruktur

```
src/
├── App.tsx                     Haupt-Komponente: State, Reducer, Layout, Toolbar
├── main.tsx                    React-Bootstrap (createRoot)
├── types.ts                    Zentrale Datentypen (Formationen, Pfeile, Cones)
├── components/
│   ├── TrackCanvas.tsx         Zeichenfläche: Drag&Drop, Auswahl, Pfeile, Rendering
│   ├── MapBackground.tsx       Rendering der OSM-Kachel(n) hinter der Strecke
│   ├── MapSelector.tsx         Modal zur Auswahl/Drehung des Kartenausschnitts
│   └── FormationThumbnail.tsx  SVG-Vorschau einer Formation (Palette, Submenüs)
└── lib/
    ├── formationRegistry.ts    Zentrales Register aller Formationen + Dauern
    ├── formations/*.ts         Geometrie-Definition je Formation (Cone-Layouts)
    ├── geometry.ts             Hilfsfunktionen für Cone-Koordinaten/Normalisierung
    ├── geo.ts                  Umrechnung Geokoordinaten ↔ Meter
    ├── areaSelection.ts        Typ/Hilfsfunktionen für den Kartenausschnitt
    ├── exportSVG.ts            SVG-Generierung, Download, Druck-als-PDF
    ├── storage.ts              localStorage-Autosave, JSON-Export/Import
    └── validation/             Regelprüfung (Geometrie + Strecken-Logik)
```

## 3. State-Management & Datenmodell

### 3.1 Track-State mit Undo/Redo

Der zentrale Streckenzustand (`TrackState = { items, arrows }`) wird über
`useReducer` (siehe `trackReducer` in [App.tsx](src/App.tsx)) verwaltet und in
einem History-Objekt `{ past, present, future }` gehalten (max. 30 Schritte).

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

### 3.2 Datentypen ([types.ts](src/types.ts))

- `FormationDefinition`: statische Beschreibung einer Formation (Label,
  Beschreibung, `cones: ConePoint[]`, optionaler Pfeil, Standarddauer, …).
- `PlacedFormation`: Instanz einer Formation auf der Fläche (`id`, `key`,
  `x`/`y` in Metern, `rotationDeg`, `direction`, optionales
  `durationSeconds`-Override).
- `PlacedArrow`: frei gezeichneter Bézier-Pfeil (Start/Ende + Kontrollpunkt).
- `ConePoint`: einzelne Pylone/Markierung (`kind: standing | lying | sensor`,
  optionale `role`/`angleDeg`).

### 3.3 Formationen ([lib/formationRegistry.ts](src/lib/formationRegistry.ts), [lib/formations/](src/lib/formations/))

Jede Formation ist als eigenes Modul in `lib/formations/` definiert und liefert
eine `FormationDefinition` mit normalisierten Cone-Koordinaten
(`normalizeCones`, siehe [geometry.ts](src/lib/geometry.ts)). Das Registry
sammelt alle Definitionen, ergänzt formation-spezifische
Standard-Durchfahrzeiten (`DEFAULT_DURATIONS`) und stellt
`getFormation(key)` / `getEffectiveDuration(...)` bereit.

Neue Formation hinzufügen:

1. Neues Modul in `lib/formations/` anlegen, das eine `FormationDefinition`
   exportiert (Cone-Layout über `meter()`/`standing()`/`lying()` aus
   `formations/common.ts` aufbauen, dann `normalizeCones(...)`).
2. Den neuen `FormationKey` in [types.ts](src/types.ts) ergänzen.
3. Die Definition in `RAW_FORMATIONS` (formationRegistry.ts) registrieren und
   bei Bedarf einen Eintrag in `DEFAULT_DURATIONS` vornehmen.
4. Die Formation einer Gruppe in `FORMATION_GROUPS` (App.tsx) zuordnen, damit
   sie in der Palette erscheint.

## 4. Zeichenfläche ([TrackCanvas.tsx](src/components/TrackCanvas.tsx))

Die Zeichenfläche rendert die Fläche (mit optionalem Kartenhintergrund über
`MapBackground`), alle platzierten Formationen (als Cones) sowie frei
gezeichnete Pfeile. Sie ist verantwortlich für:

- Umrechnung Bildschirm- ↔ Meter-Koordinaten (Skalierung anhand der
  Feldmaße/Container-Größe)
- Drag & Drop einzelner und mehrerer Formationen (`onMove`/`onMoveMultiple`),
  inkl. Mehrfachauswahl per Shift+Klick und Rahmen-Auswahl
- Zeichnen, Verschieben und Anpassen von Pfeilen (Bézier-Kurven mit
  Kontrollpunkt + zwei Endpunkten)
- Hervorhebung von Validierungs-Problemen (`issues`-Prop) auf betroffenen
  Formationen

## 5. Kartenintegration

- [MapBackground.tsx](src/components/MapBackground.tsx): rendert OpenStreetMap-
  Kacheln direkt als `<img>`-Elemente hinter der Zeichenfläche (kein
  Karten-Framework wie Leaflet/MapLibre).
- [MapSelector.tsx](src/components/MapSelector.tsx): Modal, in dem Nutzer:innen
  einen rechteckigen Bereich auf der Karte markieren, drehen und in der Größe
  anpassen können. Das Ergebnis ist eine `AreaSelection`
  (Mittelpunkt-Geokoordinaten, Breite/Höhe in Metern, Rotation).
- [lib/geo.ts](src/lib/geo.ts): Umrechnung zwischen Geokoordinaten und Metern
  (lokale Projektion um den gewählten Mittelpunkt).

Wird kein Kartenausschnitt gewählt, arbeitet die App rein mit manuell
eingegebenen Feldmaßen (Breite/Länge in Metern, Mindestgröße 8 m).

## 6. Validierung ([lib/validation/](src/lib/validation/))

`runValidation(fieldWidth, fieldLength, items)` ([index.ts](src/lib/validation/index.ts))
kombiniert zwei unabhängige Prüfungen zu einer Liste von `ValidationIssue`
(`severity: "error" | "warning"`, optional mit `formationId` für Klick-Fokus):

- **Geometrie** ([geometry.ts](src/lib/validation/geometry.ts)): prüft, ob
  Markierungen/Formationen über den Rand der Fläche hinausragen und ob Pylonen
  unterschiedlicher Formationen nahezu aufeinanderstehen.
- **Strecken-Logik** ([track.ts](src/lib/validation/track.ts)): rekonstruiert
  anhand der Cone-Positionen einen groben Fahrfluss (`orderTrackGreedy`,
  `buildConnectedComponents`) und prüft u. a.
  - ob überhaupt Formationen platziert sind,
  - ob Aufgaben zu weit auseinander liegen oder die Strecke in getrennte
    Bereiche zerfällt,
  - ob ein Start-/Zielbereich erkennbar ist,
  - ob ein Vorstartbereich bzw. eine Wechselzone vorhanden sind (jeweils
    Pflicht laut Regelwerk).

Die UI zeigt Fehler/Hinweise in der Sektion „Prüfung“ an; ein Klick auf eine
Meldung mit `formationId` selektiert die betroffene Formation auf der Fläche.

## 7. Persistenz ([lib/storage.ts](src/lib/storage.ts))

- **Autosave**: `App.tsx` speichert den kompletten Zustand (Items, Pfeile,
  Feldmaße, Kartenausschnitt, Kartenoptionen) debounced (1 s nach der letzten
  Änderung) per `saveState` in `localStorage` unter dem Schlüssel
  `kartslalom_autosave`. Beim Start wird `loadState()` einmalig aufgerufen
  (`_initialSaved`, Modul-Variable, gemeinsam für alle Lazy-Initializer).
- **Versionierung**: `SavedState.version` (`CURRENT_VERSION = 1`). Stimmt die
  Version beim Laden/Import nicht überein, wird der gespeicherte Stand
  verworfen bzw. der Import abgelehnt. Bei strukturellen Änderungen am
  gespeicherten Format muss `CURRENT_VERSION` erhöht und ggf. eine
  Migrationslogik ergänzt werden.
- **Datei-Export/-Import**: `exportAsFile`/`parseImportFile` schreiben bzw.
  lesen denselben `SavedState` als JSON-Datei (`kartslalom_<datum>.json`).

## 8. Export ([lib/exportSVG.ts](src/lib/exportSVG.ts))

- `generateTrackSVG(fieldWidth, fieldLength, items, arrows)` baut ein
  eigenständiges SVG-Dokument (Fläche, Cones, Pfeile, Beschriftungen) als
  String auf — unabhängig von der React-Zeichenfläche, sodass es als Datei
  heruntergeladen oder gedruckt werden kann.
- `downloadSVG(svgString)` löst den Datei-Download aus.
- `printAsPDF(svgString, fieldWidth, fieldLength)` öffnet das SVG in einem
  neuen Tab/Fenster und ruft `window.print()` auf — die PDF-Erzeugung
  übernimmt der Browser-Druckdialog (kein serverseitiges PDF-Rendering).

## 9. Responsives Layout

`useIsMobile()` (App.tsx) beobachtet `window.matchMedia` mit der Schwelle
`MOBILE_BREAKPOINT = 860`. Unterhalb dieser Breite wechselt das Layout von der
3-Spalten-Ansicht (Formationen | Fläche | Eigenschaften) zu einer
einspaltigen Ansicht mit zwei einblendbaren Drawern (`mobilePanel`:
`"formations" | "properties" | null`), die über Buttons in der Toolbar
geöffnet/geschlossen werden (`mobileDrawerStyle`, `DrawerHeader`).

## 10. Tastaturkürzel

Implementiert in einem globalen `keydown`-Listener in `App.tsx`:

| Kürzel | Wirkung |
| --- | --- |
| `⌘Z` / `Strg+Z` | Rückgängig |
| `⌘⇧Z` / `Strg+Y` / `Strg+⇧+Z` | Wiederherstellen |
| `Esc` | Zurück in den Auswahl-Modus |
| `Entf` / `Rücktaste` | Auswahl löschen (Formationen oder Pfeil) — wird ignoriert, wenn ein Eingabefeld fokussiert ist |
| `Shift+Klick` | Mehrfachauswahl von Formationen |

## 11. Build & Deployment

- **Entwicklung**: `npm run dev` (Vite-Dev-Server). Für eine containerisierte
  Dev-Umgebung mit HMR siehe `Dockerfile.dev` / `docker-compose.dev.yml`.
- **Build**: `npm run build` (führt zunächst `tsc --noEmit` für die
  Typprüfung aus, dann `vite build`).
- **Produktion**: [Dockerfile](Dockerfile) — Mehrstufiger Build
  (Node → statischer Build → nginx). [nginx.conf](nginx.conf) konfiguriert
  SPA-Routing (`try_files … /index.html`), Gzip, Cache-Header für Assets sowie
  grundlegende Security-Header (`X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).
- `docker-compose.yml` startet den Produktions-Container (Port 5173 → 80).

## 12. Geplante Weiterentwicklung

Die Dokumente [SAAS_PLAN.md](SAAS_PLAN.md) und
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) beschreiben die geplante
Transformation des aktuellen MVP (rein clientseitig, ohne Backend) in eine
SaaS-Anwendung mit Login, Cloud-Speicherung und Bezahlfunktionen
(Supabase, Stripe, Resend, Hetzner/Coolify). Diese Pläne sind noch nicht
umgesetzt — der aktuelle Stand entspricht „PHASE 0 / IST-Analyse“ in jenen
Dokumenten.

## 13. Lizenz

Das Projekt steht unter der **GNU General Public License v3.0 (GPLv3)**, siehe
[LICENSE](LICENSE). Hinweise zu offenen Punkten bei der Lizenz-Konformität
finden sich im Abschnitt „Lizenz-Konformität“ weiter unten in diesem
Dokument bzw. wurden im Rahmen der Analyse separat mitgeteilt.

### 13.1 Offene Punkte zur GPLv3-Konformität

- ~~**Lizenzhinweis im Quellcode**~~ — *erledigt*: Jede Datei in `src/`
  trägt jetzt den von der GPL empfohlenen Copyright-/Lizenzkopf (siehe
  Abschnitt „How to Apply These Terms“ am Ende der [LICENSE](LICENSE)-Datei).
- **Quellcode-Zugriff für Nutzer:innen der gehosteten Version**: Die App wird
  als statisches JavaScript an Browser ausgeliefert. Nach verbreiteter
  Auslegung gilt das Ausliefern von Quellcode/Bundles an Nutzer:innen als
  „Conveying“ im Sinne der GPLv3 (anders als bei der AGPL geht es hier nicht
  um „Network Use“, sondern um die Übertragung des (transpilierten/gebündelten)
  Programms an den Browser). Damit greift die Pflicht aus §6, den
  Empfänger:innen Zugang zum „Corresponding Source“ zu verschaffen — z. B.
  durch einen sichtbaren Link zum öffentlichen Repository inkl. Lizenztext
  in der Anwendung selbst.
- **Copyright-/Lizenzangabe in der Anwendung**: Es gibt aktuell keine
  „About“-Information in der App, die Lizenz, Copyright-Inhaber:in und einen
  Link zum Quellcode nennt.

Konkrete Empfehlungen siehe Abschnitt „GPLv3-Konformität“ der
Konversation/des Übergabeprotokolls (To-dos für die Lizenzkonformität).
