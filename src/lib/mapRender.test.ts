// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect } from "vitest";
import { computeMapRenderLayout } from "./mapRender";
import type { AreaSelection } from "./areaSelection";

const mainzSelection: AreaSelection = {
  centerLat: 49.9929,
  centerLng: 8.2473,
  widthM: 40,
  heightM: 60,
  rotationDeg: 0,
};

describe("computeMapRenderLayout", () => {
  it("osm liefert ein Kachel-Grid (kind: xyz)", () => {
    const layout = computeMapRenderLayout({ selection: mainzSelection, providerId: "osm", opacity: 0.5 }, 900, 1350);
    expect(layout.kind).toBe("xyz");
    if (layout.kind === "xyz") {
      expect(layout.tiles.length).toBeGreaterThan(0);
      for (const tile of layout.tiles) {
        expect(tile.url).toContain("tile.openstreetmap.org");
      }
    }
  });

  it("rlp_dop20 liefert ein Einzelbild (kind: wms) mit korrekter GetMap-URL", () => {
    const layout = computeMapRenderLayout({ selection: mainzSelection, providerId: "rlp_dop20", opacity: 0.5 }, 900, 1350);
    expect(layout.kind).toBe("wms");
    if (layout.kind === "wms") {
      expect(layout.imageUrl).toContain("geo4.service24.rlp.de/wms/rp_dop20.fcgi");
      expect(layout.imageUrl).toContain("SERVICE=WMS");
      expect(layout.imageUrl).toContain("SRS=EPSG%3A3857");
      expect(layout.bgW).toBeGreaterThan(0);
      expect(layout.bgH).toBeGreaterThan(0);
    }
  });

  it("beide Provider liefern dieselbe bgW/bgH-Box für dieselbe Auswahl (nur Bildquelle unterscheidet sich)", () => {
    const xyz = computeMapRenderLayout({ selection: mainzSelection, providerId: "osm", opacity: 1 }, 900, 1350);
    const wms = computeMapRenderLayout({ selection: mainzSelection, providerId: "rlp_dop20", opacity: 1 }, 900, 1350);
    expect(wms.bgW).toBeCloseTo(xyz.bgW, 5);
    expect(wms.bgH).toBeCloseTo(xyz.bgH, 5);
    expect(wms.left).toBeCloseTo(xyz.left, 5);
    expect(wms.top).toBeCloseTo(xyz.top, 5);
  });

  it("rotierte Auswahl vergrößert die Box (Oversizing für die CSS-Rotation)", () => {
    const rotated: AreaSelection = { ...mainzSelection, rotationDeg: 45 };
    const layout = computeMapRenderLayout({ selection: rotated, providerId: "osm", opacity: 1 }, 900, 900);
    expect(layout.bgW).toBeGreaterThan(900);
    expect(layout.bgH).toBeGreaterThan(900);
  });
});
