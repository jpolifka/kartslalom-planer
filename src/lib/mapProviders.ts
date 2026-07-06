// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

// Zentrale Registry für Kartenhintergrund-Anbieter. Ersetzt die bisher in
// MapBackground.tsx und exportSVG.ts duplizierten Esri/OSM-URL-Ternaries.
// "xyz" = Kachel-Pyramide (aktuell OSM + Esri, beide über {z}/{x}/{y}-URLs
// adressierbar); "wms" = Einzelbild pro Anfrage (z. B. RLP-DOP20, Commit 3).

export type MapProviderId = "osm" | "esri";

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
};

export function mapProviderForSatelliteFlag(satellite: boolean): MapProvider {
  return satellite ? MAP_PROVIDERS.esri : MAP_PROVIDERS.osm;
}
