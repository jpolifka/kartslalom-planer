# Export (SVG / PDF / PNG)

[`lib/exportSVG.ts`](../src/lib/exportSVG.ts) erzeugt aus dem aktuellen
Streckenzustand ein eigenständiges, druckbares Dokument — unabhängig von der
React-Zeichenfläche.

## SVG-Generierung

`generateTrackSVG(fieldWidth, fieldLength, items, arrows, mapConfig?, background?)`
baut ein vollständiges SVG-Dokument als String auf: Streckenfläche, alle
Cones (mit Berücksichtigung von Drehung/Ausrichtung), Pfeile und
Beschriftungen; alle Texte (Formationsnamen, Kartenquellenvermerk) werden dabei
XML-escaped, damit ein frei gewählter Formationsname keine aktiven Elemente
einschleusen kann. Der optionale `background`-Parameter (`"white"` | `"transparent"`,
Default `"white"`) steuert nur den Fall ohne Kartenhintergrund (`mapConfig`
nicht gesetzt) — mit Kartenhintergrund ist die Fläche ohnehin durch die Tiles
gefüllt. Der Kartenhintergrund kommt als `<image>`-Elemente in das SVG (Kacheln bzw.
WMS-Bild, siehe unten). Da das Ergebnis ein reiner String ist, kann es sowohl
heruntergeladen als auch für PDF/PNG weiterverarbeitet werden.

## Download (SVG)

`downloadSVG(svg, filename = "kartslalom.svg")` erzeugt aus dem SVG-String einen Blob
und löst über ein unsichtbares `<a>`-Element den Datei-Download aus.

## PDF

`exportPDF(fieldWidth, fieldLength, items, arrows, mapConfig?, filename?)`
rendert das generierte SVG (inkl. Kartenhintergrund, falls gesetzt) vektoriell
in ein PDF (A4 quer) via `jsPDF` + `svg2pdf.js` und löst direkt den Datei-Download
aus (Standarddateiname `kartslalom-streckenplan.pdf`) — **kein** Druckdialog des
Browsers, kein serverseitiges Rendering. Kopfzeile: „Kartslalom Streckenplan“ und
die Feldmaße („B m × L m“).

## Kartenhintergrund bei SVG und PDF

Bei Kacheln (`osm`) verweist das SVG direkt auf die Kachel-URLs. Beim WMS-Anbieter
(`rlp_dop20`) lädt `resolveWmsExportImage` das Bild vorab und bettet es als
data-URI ein, damit das Ergebnis nicht von der Erreichbarkeit des Dienstes abhängt:
eingeloggt über die Edge Function `map-background-image` (Allowlist-Proxy: nimmt nur
Anbieter-ID, BBox und Größe entgegen), als Gast per direktem Abruf mit Timeout und
Größenlimit. Schlägt der Gast-Abruf fehl, bleibt die rohe WMS-URL im Export
(Best-Effort). Das Layout kommt aus `lib/mapRender.ts` und ist mit dem Editor
identisch, siehe [kartenintegration.md](kartenintegration.md).

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
- UI: `pages/editor/components/Toolbar.tsx` → Dropdown „Exportieren / Importieren“
  mit den Einträgen „Als SVG“, „Als PDF“, „Als PNG (weiß)“, „Als PNG (transparent)“
  und „Als JSON“.

**Kartenhintergrund bewusst ausgeschlossen**: Die Kartenanbieter (OSM-Tiles,
RLP-DOP20-WMS) liefern keine verlässlichen CORS-Header, wodurch das Canvas
nach dem Zeichnen der Tiles/des WMS-Bilds "tainted" wäre und
`canvas.toBlob()` fehlschlagen bzw. einen SecurityError werfen kann.
PNG-Export zeigt daher nur Strecke/Pylonen, ohne Kartenraster — für SVG/PDF
ist das kein Problem, da dort `<image>`-Referenzen statt gerasterter Pixel
verwendet werden.

**Tier-Gating**: PNG-Export ist ein Pro-Feature (`useTier().canExportPng`,
analog zu Luftbild/Share-Links/Versionshistorie; nur im Cloud-Modus — Gäste ohne
Account können PNG exportieren). Die Prüfung ist rein UX-seitig (Button gesperrt + "Pro"-Hinweis) — es gibt keinen serverseitigen
Endpunkt, der etwas zu gaten hätte, da PNG-Export vollständig clientseitig
läuft.

## JSON-Export

Der JSON-Export/-Import des kompletten Streckenzustands (zur
Weiterbearbeitung oder zum Teilen) ist Teil der Persistenzschicht, siehe
[Persistenz](persistenz.md#datei-export-import-json).
