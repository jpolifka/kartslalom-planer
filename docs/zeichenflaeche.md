# Zeichenfläche

Die Zeichenfläche ([`TrackCanvas.tsx`](../src/components/TrackCanvas.tsx))
rendert die Streckenfläche (mit optionalem Kartenhintergrund über
`MapBackground`, siehe [Kartenintegration](kartenintegration.md)), alle
platzierten Formationen (als Cones) sowie frei gezeichnete Pfeile.

Sie ist verantwortlich für:

- **Koordinatenumrechnung**: Bildschirm- ↔ Meter-Koordinaten (Skalierung
  anhand der Feldmaße und der Container-Größe)
- **Drag & Drop**: Verschieben einzelner und mehrerer Formationen
  (`onMove`/`onMoveMultiple`), inklusive Mehrfachauswahl per Shift+Klick;
  ein Klick auf die leere Fläche hebt die Auswahl auf (`onDeselectAll`)
- **Pfeile**: Zeichnen, Verschieben und Anpassen von Bézier-Pfeilen
  (Kontrollpunkt + zwei Endpunkte) zur Markierung der Fahrtrichtung
- **Validierungs-Hervorhebung**: visuelle Markierung von Formationen, auf die
  sich eine `ValidationIssue` bezieht (`issues`-Prop, Rahmenfarbe nach
  `severity`), inklusive Klick-Fokus aus der Prüfungs-Sektion im `RightPanel`

Die Zeichenfläche selbst hält keinen Anwendungszustand — sie ist eine
kontrollierte Komponente, die ihren Zustand (Items, Pfeile, Auswahl, Modus)
als Props von [EditorPage.tsx](../src/pages/EditorPage.tsx) erhält und Änderungen über
Callbacks (`onMove`, `onSelect`, `onArrowDrawn`, …) nach oben meldet, wo sie über den
Track-Reducer verarbeitet werden (siehe [Architektur](architektur.md#track-editor)).

Der Formation-Editor hat eine eigene, davon unabhängige Zeichenfläche
([`FormationEditorCanvas.tsx`](../src/components/formation-editor/FormationEditorCanvas.tsx))
mit Snapping, Hilfslinien und Maßlinien; ihr Koordinatensystem ist im Dateikopf
beschrieben.
