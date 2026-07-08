# Export (SVG / PDF / PNG)

[`lib/exportSVG.ts`](../src/lib/exportSVG.ts) erzeugt aus dem aktuellen
Streckenzustand ein eigenständiges, druckbares Dokument — unabhängig von der
React-Zeichenfläche.

## SVG-Generierung

`generateTrackSVG(fieldWidth, fieldLength, items, arrows, mapConfig?, background?)`
baut ein vollständiges SVG-Dokument als String auf: Streckenfläche, alle
Cones (mit Berücksichtigung von Drehung/Ausrichtung), Pfeile und
Beschriftungen. Der optionale `background`-Parameter (`"white"` | `"transparent"`,
Default `"white"`) steuert nur den Fall ohne Kartenhintergrund (`mapConfig`
nicht gesetzt) — mit Kartenhintergrund ist die Fläche ohnehin durch die Tiles
gefüllt. Da das Ergebnis ein reiner String ist, kann es sowohl heruntergeladen
als auch für PDF/PNG weiterverarbeitet werden.

## Download (SVG)

`downloadSVG(svgString)` erzeugt aus dem SVG-String einen Blob und löst über
ein unsichtbares `<a>`-Element den Datei-Download aus.

## PDF

`exportPDF(fieldWidth, fieldLength, items, arrows, mapConfig?, filename?)`
rendert das generierte SVG (inkl. Kartenhintergrund, falls gesetzt) vektoriell
in ein PDF via `jsPDF` + `svg2pdf.js` und löst direkt den Datei-Download aus
— **kein** Druckdialog des Browsers, kein serverseitiges Rendering.

## PNG

[`features/png-export/`](../src/features/png-export/) rasterisiert das von
`generateTrackSVG()` erzeugte SVG (ohne Kartenhintergrund — siehe unten) über
ein Offscreen-`<canvas>` zu einem PNG:

- `api/renderTrackPng.ts`: `buildTrackPngBlob(fieldWidth, fieldLength, items, arrows, background)`
  lädt das SVG als `Image`, zeichnet es 3-fach vergrößert (siehe `PNG_SCALE`)
  auf ein `<canvas>` und liefert das Ergebnis per `canvas.toBlob("image/png")`
  als `Blob`. `pngFilenameFromTrackName(trackName)` leitet den Dateinamen aus
  dem Streckennamen ab (Fallback: `kartslalom.png`).
- `hooks/useExportPng.ts`: verbindet Rendering und Download (`exportPng(...)`).
- UI: `Toolbar.tsx` → Download-Dropdown, zwei Einträge ("Als PNG (weiß)" /
  "Als PNG (transparent)").

**Kartenhintergrund bewusst ausgeschlossen**: Die Kartenanbieter (OSM-Tiles,
RLP-DOP20-WMS) liefern keine verlässlichen CORS-Header, wodurch das Canvas
nach dem Zeichnen der Tiles/des WMS-Bilds "tainted" wäre und
`canvas.toBlob()` fehlschlagen bzw. einen SecurityError werfen kann.
PNG-Export zeigt daher nur Strecke/Pylonen, ohne Kartenraster — für SVG/PDF
ist das kein Problem, da dort `<image>`-Referenzen statt gerasterter Pixel
verwendet werden.

**Tier-Gating**: PNG-Export ist ein Pro-Feature (`useTier().canExportPng`,
analog zu Satellitenbild/Share-Links/Versionshistorie). Die Prüfung ist rein
UX-seitig (Button gesperrt + "Pro"-Hinweis) — es gibt keinen serverseitigen
Endpunkt, der etwas zu gaten hätte, da PNG-Export vollständig clientseitig
läuft.

## JSON-Export

Der JSON-Export/-Import des kompletten Streckenzustands (zur
Weiterbearbeitung oder zum Teilen) ist Teil der Persistenzschicht, siehe
[Persistenz](persistenz.md#datei-export-import-json).
