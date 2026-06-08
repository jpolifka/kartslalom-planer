# Architektur

## Projektstruktur

```
src/
├── App.tsx                     Haupt-Komponente: State, Reducer, Layout, Toolbar
├── main.tsx                    React-Bootstrap (createRoot)
├── types.ts                    Zentrale Datentypen (Formationen, Pfeile, Cones)
├── components/
│   ├── TrackCanvas.tsx         Zeichenfläche: Drag & Drop, Auswahl, Pfeile, Rendering
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

Detaillierte Beschreibungen der einzelnen Bereiche befinden sich in den
benachbarten Dokumenten dieses Verzeichnisses (siehe [README](../README.md#architektur--konzepte)).

## State-Management & Datenmodell

### Track-State mit Undo/Redo

Der zentrale Streckenzustand (`TrackState = { items, arrows }`) wird über
`useReducer` (siehe `trackReducer` in [App.tsx](../src/App.tsx)) verwaltet und
in einem History-Objekt `{ past, present, future }` gehalten (max. 30 Schritte).

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
