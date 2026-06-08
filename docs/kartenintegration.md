# Kartenintegration

Die App kann eine Strecke wahlweise frei (über manuell eingegebene Feldmaße)
oder über einen realen Kartenausschnitt platzieren.

## Komponenten

- [`MapBackground.tsx`](../src/components/MapBackground.tsx): rendert
  OpenStreetMap-Kacheln direkt als `<img>`-Elemente hinter der Zeichenfläche —
  bewusst **ohne** Karten-Framework wie Leaflet oder MapLibre, um die
  Abhängigkeiten gering zu halten.
- [`MapSelector.tsx`](../src/components/MapSelector.tsx): Modal, in dem
  Nutzer:innen einen rechteckigen Bereich auf der Karte markieren, drehen und
  in der Größe anpassen können. Das Ergebnis ist eine `AreaSelection`
  (Mittelpunkt-Geokoordinaten, Breite/Höhe in Metern, Rotation — siehe
  [`areaSelection.ts`](../src/lib/areaSelection.ts)).
- [`geo.ts`](../src/lib/geo.ts): Umrechnung zwischen Geokoordinaten und Metern
  über eine lokale Projektion um den gewählten Mittelpunkt.

## Manueller Modus

Wird kein Kartenausschnitt gewählt, arbeitet die App rein mit manuell
eingegebenen Feldmaßen (Breite/Länge in Metern, Mindestgröße 8 m,
siehe `manualWidth`/`manualLength` in [App.tsx](../src/App.tsx)). `fieldWidth`
und `fieldLength` ergeben sich dann direkt aus diesen Eingaben statt aus der
`AreaSelection`.
