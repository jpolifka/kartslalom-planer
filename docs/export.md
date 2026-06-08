# Export (SVG / PDF)

[`lib/exportSVG.ts`](../src/lib/exportSVG.ts) erzeugt aus dem aktuellen
Streckenzustand ein eigenständiges, druckbares Dokument — unabhängig von der
React-Zeichenfläche.

## SVG-Generierung

`generateTrackSVG(fieldWidth, fieldLength, items, arrows)` baut ein
vollständiges SVG-Dokument als String auf: Streckenfläche, alle Cones (mit
Berücksichtigung von Drehung/Ausrichtung), Pfeile und Beschriftungen. Da das
Ergebnis ein reiner String ist, kann es sowohl heruntergeladen als auch in
einem neuen Fenster zum Drucken geöffnet werden.

## Download

`downloadSVG(svgString)` erzeugt aus dem SVG-String einen Blob und löst über
ein unsichtbares `<a>`-Element den Datei-Download aus.

## PDF (Druck)

`printAsPDF(svgString, fieldWidth, fieldLength)` öffnet das generierte SVG in
einem neuen Tab/Fenster (passend zu den Feldmaßen formatiert) und ruft
`window.print()` auf. Die eigentliche PDF-Erzeugung übernimmt der
**Druckdialog des Browsers** — es findet kein serverseitiges
PDF-Rendering statt (es gibt ohnehin keinen Server).

## JSON-Export

Der JSON-Export/-Import des kompletten Streckenzustands (zur
Weiterbearbeitung oder zum Teilen) ist Teil der Persistenzschicht, siehe
[Persistenz](persistenz.md#datei-export-import-json).
