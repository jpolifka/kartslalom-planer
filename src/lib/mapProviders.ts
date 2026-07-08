// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

// Zentrale Registry für Kartenhintergrund-Anbieter. Ersetzt die bisher in
// MapBackground.tsx und exportSVG.ts duplizierten Esri/OSM-URL-Ternaries.
// "xyz" = Kachel-Pyramide (OSM + Esri, beide über {z}/{x}/{y}-URLs
// adressierbar); "wms" = Einzelbild pro Anfrage (RLP-DOP20 — Anfrage liefert
// ein einzelnes Bild für eine BBox statt einer Kachel-Pyramide).
//
// Esri bleibt vorerst in der Registry (Regressionsschutz für die bestehenden
// Tests), wird aber ab hier von keinem Render-Pfad mehr ausgewählt —
// map_satellite=true bildet ab jetzt auf "rlp_dop20" ab, nicht mehr "esri"
// (siehe mapProviderIdForSatelliteFlag). Endgültige Entfernung in Commit 5.

export type MapProviderId = "osm" | "esri" | "rlp_dop20";

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
  esri: {
    id: "esri",
    label: "Satellitenbild",
    kind: "xyz",
    requiresPro: true,
    attribution: "Esri, Maxar, Earthstar Geographics",
    // ArcGIS-REST-Tile-Adressierung ist zoom/y/x (nicht zoom/x/y wie bei OSM) —
    // x/y hier bewusst vertauscht in den Template-String übernommen.
    xyzTileUrl: (zoom, x, y) =>
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`,
  },
  rlp_dop20: {
    id: "rlp_dop20",
    label: "Luftbild Rheinland-Pfalz",
    kind: "wms",
    requiresPro: true,
    // Amtlicher Quellenvermerk lt. Metadaten des Dienstes (LVermGeoRP,
    // dl-de/by-2-0). Jahr bewusst weggelassen (wechselnder Datenbezugsstand,
    // kein fixes Aktualisierungsdatum bekannt) — siehe docs falls präzisiert.
    attribution: "© GeoBasis-DE / LVermGeoRP, dl-de/by-2-0",
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

/** Prüft, ob ein Provider mit begrenzter Abdeckung (z. B. RLP-DOP20) den
 *  angegebenen Punkt abdeckt. Provider ohne coverage (z. B. OSM) decken
 *  immer ab. */
export function providerCoversPoint(provider: MapProvider, lat: number, lng: number): boolean {
  const b = provider.coverage;
  if (!b) return true;
  return lng >= b.west && lng <= b.east && lat >= b.south && lat <= b.north;
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

// Bildet das bisherige boolesche map_satellite auf eine Provider-ID ab —
// Brücke für Alt-Zustände (Gast-Modus-localStorage speichert weiterhin nur
// ein Boolean, siehe src/lib/storage.ts). true → "rlp_dop20", NIE "esri"
// (Esri wird von keinem Render-Pfad mehr ausgewählt, siehe Kommentar oben).
export function mapProviderIdForSatelliteFlag(satellite: boolean): MapProviderId {
  return satellite ? "rlp_dop20" : "osm";
}
