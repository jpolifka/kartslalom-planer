# Kartenintegration

Eine Strecke kann wahlweise frei (über manuell eingegebene Feldmaße) oder über
einen realen Kartenausschnitt platziert werden. Der Kartenhintergrund selbst wird
ohne Karten-Framework (Leaflet, MapLibre) gerendert, um die Abhängigkeiten gering
zu halten.

## Kartenanbieter ([`mapProviders.ts`](../src/lib/mapProviders.ts))

Zentrale Registry (`MAP_PROVIDERS`), die Strecke speichert nur die
`map_provider_id`:

| ID | Anzeige | Art | Tarif | Abdeckung |
| --- | --- | --- | --- | --- |
| `osm` | Straßenkarte | `xyz` — Kachelpyramide (`tile.openstreetmap.org`) | alle | weltweit |
| `rlp_dop20` | Luftbild Rheinland-Pfalz | `wms` — ein Bild pro Anfrage (EPSG:3857-BBox) | Pro/Team (`requiresPro`) | nur Rheinland-Pfalz (`coverage`) |

Jeder Anbieter trägt seinen Quellenvermerk (`attribution`), der im Editor und im
Export erscheint. `providerCoversBounds()` prüft die **komplette (rotierte)
Auswahl-Envelope**, nicht nur den Mittelpunkt. Liegt ein Ausschnitt außerhalb der
Abdeckung, fällt nur das **Rendering** auf OSM zurück; die gespeicherte Auswahl
bleibt unverändert. Im Cloud-Modus lehnt der Server einen Premium-Anbieter für
Free-Nutzer ab (`MAP_PROVIDER_REQUIRES_PRO`, siehe [persistenz.md](persistenz.md)).
Neue Anbieter siehe `mapProviderConfigDrift.test.ts`, das die Konfiguration von
Client und Edge Function auf Konsistenz prüft.

## Komponenten und Bibliotheken

- [`MapBackground.tsx`](../src/components/MapBackground.tsx): reines Rendering des
  Hintergrunds hinter der Zeichenfläche — bei `xyz` ein Raster aus `<img>`-Kacheln,
  bei `wms` ein einzelnes `<img>`.
- [`mapRender.ts`](../src/lib/mapRender.ts): gemeinsame Layout-Berechnung
  (`computeMapRenderLayout`: Kachelraster bzw. WMS-BBox, Rotation, Oversizing der
  Hintergrundfläche). Editor und SVG/PDF-Export nutzen dieselbe Funktion, damit
  Vorschau und Export exakt denselben Ausschnitt zeigen.
- [`MapSelector.tsx`](../src/components/MapSelector.tsx): Modal zur Wahl des
  Ausschnitts. Ein Rechteck lässt sich verschieben, in der Größe anpassen und
  drehen; alternativ zeichnet man ein Polygon (mindestens drei Punkte, Schließen per
  Klick auf den ersten Punkt oder Button), aus dem die kleinste umschließende,
  gedrehte Box abgeleitet wird (`polygonToAreaSelection`).
- [`areaSelection.ts`](../src/lib/areaSelection.ts): `AreaSelection`
  (Mittelpunkt in Grad, `widthM`/`heightM` in Metern, `rotationDeg` im Uhrzeigersinn
  ab Nord). Rechnet in einem lokalen, ebenen Meter-Koordinatensystem um den
  Mittelpunkt (äquirechteckige Näherung, für Feldgrößen im Meterbereich
  ausreichend).
- [`geo.ts`](../src/lib/geo.ts): Web-Mercator-Formeln für die Kachelpyramide
  (Geokoordinaten ↔ globale Pixel je Zoomstufe), EPSG:3857-Meter für WMS-BBoxen und
  Haversine-Distanzen.

## Effektive Feldgröße

Mit Kartenausschnitt ergeben sich Feldbreite und -länge aus `areaSel.widthM` /
`areaSel.heightM`, **nicht** aus `manualWidth`/`manualLength` (siehe
[architektur.md](architektur.md#karte-und-export)).

## Manueller Modus

Ohne Kartenausschnitt arbeitet die App mit manuell eingegebenen Feldmaßen (Breite/Länge
in Metern, Mindestgröße 8 m — `Math.max(8, …)` in
[EditorPage.tsx](../src/pages/EditorPage.tsx); Eingabefelder in `LeftSidebar`).

## Kartenhintergrund im Export

SVG und PDF betten den Hintergrund als `<image>`-Elemente ein (Kacheln bzw. WMS-Bild).
Bei WMS wird das Bild vor dem Export geladen und als data-URI eingebettet
(`resolveWmsExportImage`): eingeloggt über die Edge Function `map-background-image`
(Allowlist-Proxy, nimmt nur Anbieter-ID und BBox entgegen), als Gast per direktem
Abruf mit Timeout und Größenlimit — schlägt der fehl, bleibt die rohe WMS-URL im
Export (Best-Effort). PNG-Export und öffentliche Share-Links zeigen bewusst **keinen**
Kartenhintergrund, siehe [export.md](export.md) und
[track-share-links.md](track-share-links.md).
