// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

// Zentrale Registry für Kartenhintergrund-Anbieter. Ersetzt die vormals in
// MapBackground.tsx und exportSVG.ts duplizierten URL-Ternaries.
// "xyz" = Kachel-Pyramide (OSM, über {z}/{x}/{y}-URLs adressierbar);
// "wms" = Einzelbild pro Anfrage (RLP-DOP20 — Anfrage liefert ein einzelnes
// Bild für eine BBox statt einer Kachel-Pyramide).
//
// Esri World Imagery wurde entfernt (Lizenzrisiko bei öffentlicher/
// kommerzieller Nutzung, siehe project_esri_osm_licensing-Notiz) und durch
// den amtlichen RLP-DOP20-Dienst ersetzt.

import type { GeoBounds } from "./geo";

export type MapProviderId = "osm" | "rlp_dop20";

export type GeographicBounds = { west: number; south: number; east: number; north: number };

export type WmsConfig = {
  baseUrl: string;
  layers: string;
  format: string;
  version: "1.1.1" | "1.3.0";
};

export type MapProvider = {
  id: MapProviderId;
  label: string;
  kind: "xyz" | "wms";
  attribution: string;
  requiresPro: boolean;
  /** Nur für kind: "xyz". Weltweite Abdeckung, wenn nicht gesetzt. */
  coverage?: GeographicBounds;
  /** Nur für kind: "xyz". */
  xyzTileUrl?: (zoom: number, x: number, y: number) => string;
  /** Nur für kind: "wms". */
  wms?: WmsConfig;
};

export const MAP_PROVIDERS: Record<MapProviderId, MapProvider> = {
  osm: {
    id: "osm",
    label: "Straßenkarte",
    kind: "xyz",
    requiresPro: false,
    attribution: "© OpenStreetMap contributors",
    xyzTileUrl: (zoom, x, y) => `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
  },
  rlp_dop20: {
    id: "rlp_dop20",
    label: "Luftbild Rheinland-Pfalz",
    kind: "wms",
    requiresPro: true,
    // Amtlicher Quellenvermerk lt. GetCapabilities-Fees-Feld des Dienstes:
    // "©GeoBasis-DE / LVermGeoRP (Jahr des Datenbezugs), dl-de/by-2-0,
    // http://www.lvermgeo.rlp.de [Daten bearbeitet]". "(Jahr des
    // Datenbezugs)" ist im Muster selbst nur ein Platzhalter — der Dienst
    // mosaikiert Luftbilder aus unterschiedlichen Befliegungsjahren, es gibt
    // kein einzelnes auslesbares Jahr. Jahr daher bewusst weggelassen, URL
    // und "Daten bearbeitet" (Zuschnitt/Skalierung/Rotation/Überlagerung im
    // Export) ergänzt.
    attribution: "© GeoBasis-DE / LVermGeoRP, dl-de/by-2-0, www.lvermgeo.rlp.de, Daten bearbeitet",
    // Abdeckung lt. GetCapabilities des Dienstes (LatLonBoundingBox), geprüft 2026-07-06.
    coverage: { west: 6.037773, south: 48.897996, east: 8.617703, north: 51.000893 },
    wms: {
      baseUrl: "https://geo4.service24.rlp.de/wms/rp_dop20.fcgi",
      layers: "rp_dop20",
      format: "image/jpeg",
      version: "1.1.1",
    },
  },
};

/** Prüft, ob ein Provider mit begrenzter Abdeckung die komplette (rotierte)
 *  Auswahl-Envelope abdeckt, nicht nur den Mittelpunkt — dieselbe Envelope
 *  (areaSelectionToBounds), die auch als WMS-BBox an den Export-Proxy geht.
 *  Provider ohne coverage (z. B. OSM) decken immer ab. */
export function providerCoversBounds(provider: MapProvider, bounds: GeoBounds): boolean {
  const b = provider.coverage;
  if (!b) return true;
  return (
    bounds.lng1 >= b.west &&
    bounds.lng2 <= b.east &&
    bounds.lat2 >= b.south &&
    bounds.lat1 <= b.north
  );
}

/** Baut die WMS-GetMap-URL für eine BBox (EPSG:3857-Meter,
 *  [minx, miny, maxx, maxy]) in Pixelgröße width×height. */
export function buildWmsGetMapUrl(
  wms: WmsConfig,
  bbox: [number, number, number, number],
  width: number,
  height: number
): string {
  const params = new URLSearchParams({
    SERVICE: "WMS",
    REQUEST: "GetMap",
    VERSION: wms.version,
    LAYERS: wms.layers,
    STYLES: "",
    FORMAT: wms.format,
    SRS: "EPSG:3857",
    BBOX: bbox.map((n) => n.toFixed(2)).join(","),
    WIDTH: String(Math.max(1, Math.round(width))),
    HEIGHT: String(Math.max(1, Math.round(height))),
  });
  return `${wms.baseUrl}?${params.toString()}`;
}

// Reine Legacy-Migrationshilfe: bildet das VOR der Boolean→Provider-ID-
// Migration (Kartenanbieter-Abstraktion, Commit 7) genutzte boolesche
// map_satellite auf eine Provider-ID ab. Neue Zustände speichern
// mapProviderId direkt — nur src/lib/storage.ts nutzt dies noch, um alte
// localStorage-Saves/Export-Dateien mit {mapSatellite: boolean} beim Laden
// transparent zu normalisieren. true → "rlp_dop20".
export function mapProviderIdFromLegacySatelliteFlag(satellite: boolean): MapProviderId {
  return satellite ? "rlp_dop20" : "osm";
}
