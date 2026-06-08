# Zeichenfläche

Die Zeichenfläche ([`TrackCanvas.tsx`](../src/components/TrackCanvas.tsx))
rendert die Streckenfläche (mit optionalem Kartenhintergrund über
`MapBackground`, siehe [Kartenintegration](kartenintegration.md)), alle
platzierten Formationen (als Cones) sowie frei gezeichnete Pfeile.

Sie ist verantwortlich für:

- **Koordinatenumrechnung**: Bildschirm- ↔ Meter-Koordinaten (Skalierung
  anhand der Feldmaße und der Container-Größe)
- **Drag & Drop**: Verschieben einzelner und mehrerer Formationen
  (`onMove`/`onMoveMultiple`), inklusive Mehrfachauswahl per Shift+Klick und
  Rahmen-Auswahl (Lasso)
- **Pfeile**: Zeichnen, Verschieben und Anpassen von Bézier-Pfeilen
  (Kontrollpunkt + zwei Endpunkte) zur Markierung der Fahrtrichtung
- **Validierungs-Hervorhebung**: visuelle Markierung von Formationen, auf die
  sich eine `ValidationIssue` bezieht (`issues`-Prop), inklusive Klick-Fokus
  aus der Eigenschaften-/Prüfungs-Sektion

Die Zeichenfläche selbst hält keinen Anwendungszustand — sie ist eine
kontrollierte Komponente, die ihren Zustand (Items, Pfeile, Auswahl, Modus)
als Props von [App.tsx](../src/App.tsx) erhält und Änderungen über Callbacks
(`onMove`, `onSelect`, `onArrowDrawn`, …) nach oben meldet, wo sie über den
Track-Reducer verarbeitet werden (siehe [Architektur](architektur.md#state-management--datenmodell)).
