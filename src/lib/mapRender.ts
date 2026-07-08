// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

// Gemeinsame Layout-Berechnung für den Kartenhintergrund — genutzt vom
// interaktiven Editor (MapBackground.tsx) und vom SVG/PDF-Export
// (exportSVG.ts). Vorher war die komplette Geometrie (Rotation/Oversizing/
// Tile-Grid) in beiden Dateien dupliziert; hier zusammengeführt, weil der
// neue WMS-Einzelbild-Pfad (RLP-DOP20) sonst ein drittes Mal dupliziert
// worden wäre.

import { lngToGlobalX, latToGlobalY, lngToMercatorX, latToMercatorY } from "./geo";
import { areaSelectionToBounds } from "./areaSelection";
import type { AreaSelection } from "./areaSelection";
import { MAP_PROVIDERS, buildWmsGetMapUrl } from "./mapProviders";
import type { MapProviderId } from "./mapProviders";

const TILE_SIZE = 256;

export type MapRenderConfig = {
  selection: AreaSelection;
  providerId: MapProviderId;
  opacity: number;
};

export type XyzTile = { url: string; x: number; y: number; w: number; h: number };

export type MapRenderLayout =
  | { kind: "xyz"; tiles: XyzTile[]; bgW: number; bgH: number; left: number; top: number; attribution: string }
  | {
      kind: "wms";
      imageUrl: string;
      // Rohdaten der GetMap-Anfrage, zusätzlich zur fertigen imageUrl: der
      // Export-Pfad (exportSVG.ts) ruft damit den map-background-image-
      // Edge-Function-Proxy auf, statt den WMS-Dienst direkt vom Client
      // anzusprechen (siehe docs/track-share-links.md-Nachbardokument zum
      // Export bzw. Commit 4 der Kartenanbieter-Abstraktion).
      providerId: MapProviderId;
      bbox: [number, number, number, number];
      bgW: number;
      bgH: number;
      left: number;
      top: number;
      attribution: string;
    };

// Oversize-Box: Damit nach dem CSS-rotate() der Kartengruppe die Ecken des
// (unrotierten) Feld-Canvas weiterhin abgedeckt sind, wird eine größere,
// unrotierte Box berechnet, in die Kacheln/Bild eingepasst werden.
function computeBackgroundBox(rotationDeg: number, canvasW: number, canvasH: number) {
  const θ = (rotationDeg * Math.PI) / 180;
  const cosT = Math.abs(Math.cos(θ));
  const sinT = Math.abs(Math.sin(θ));
  const bgW = canvasW * cosT + canvasH * sinT;
  const bgH = canvasW * sinT + canvasH * cosT;
  return { bgW, bgH, left: (canvasW - bgW) / 2, top: (canvasH - bgH) / 2 };
}

export function computeMapRenderLayout(
  mapConfig: MapRenderConfig,
  canvasW: number,
  canvasH: number
): MapRenderLayout {
  const provider = MAP_PROVIDERS[mapConfig.providerId];
  const { selection } = mapConfig;
  const { bgW, bgH, left, top } = computeBackgroundBox(selection.rotationDeg, canvasW, canvasH);
  const bounds = areaSelectionToBounds(selection);

  if (provider.kind === "wms") {
    if (!provider.wms) {
      throw new Error(`Provider "${provider.id}" hat kind="wms", aber keine wms-Konfiguration.`);
    }
    // bounds: lat1/lng1 = Nordwest-Ecke, lat2/lng2 = Südost-Ecke (siehe geo.ts).
    const bbox: [number, number, number, number] = [
      lngToMercatorX(bounds.lng1),
      latToMercatorY(bounds.lat2),
      lngToMercatorX(bounds.lng2),
      latToMercatorY(bounds.lat1),
    ];
    const imageUrl = buildWmsGetMapUrl(provider.wms, bbox, bgW, bgH);
    return { kind: "wms", imageUrl, providerId: provider.id, bbox, bgW, bgH, left, top, attribution: provider.attribution };
  }

  // "xyz": unveränderte Kachel-Grid-Logik aus der ursprünglichen
  // computeTileLayout()-Implementierung (Commit 1 nur URL-Bau abstrahiert).
  const lngSpan = Math.abs(bounds.lng2 - bounds.lng1);
  const zoom = Math.min(19, Math.max(1, Math.round(Math.log2((bgW * 360) / (TILE_SIZE * lngSpan)))));

  const gx1 = lngToGlobalX(bounds.lng1, zoom);
  const gy1 = latToGlobalY(bounds.lat1, zoom);
  const gx2 = lngToGlobalX(bounds.lng2, zoom);
  const gy2 = latToGlobalY(bounds.lat2, zoom);

  const scaleX = bgW / (gx2 - gx1);
  const scaleY = bgH / (gy2 - gy1);
  const n = Math.pow(2, zoom);

  const tiles: XyzTile[] = [];
  for (let ty = Math.floor(gy1 / TILE_SIZE); ty <= Math.ceil(gy2 / TILE_SIZE); ty++) {
    for (let tx = Math.floor(gx1 / TILE_SIZE); tx <= Math.ceil(gx2 / TILE_SIZE); tx++) {
      const wrappedTx = ((tx % n) + n) % n;
      const url = provider.xyzTileUrl!(zoom, wrappedTx, ty);
      tiles.push({
        url,
        x: (tx * TILE_SIZE - gx1) * scaleX,
        y: (ty * TILE_SIZE - gy1) * scaleY,
        w: TILE_SIZE * scaleX,
        h: TILE_SIZE * scaleY,
      });
    }
  }

  return { kind: "xyz", tiles, bgW, bgH, left, top, attribution: provider.attribution };
}
