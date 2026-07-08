// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect } from "vitest";
import {
  MAP_PROVIDERS,
  mapProviderIdForSatelliteFlag,
  providerCoversPoint,
  buildWmsGetMapUrl,
} from "./mapProviders";

describe("mapProviders", () => {
  it("OSM-Tile-URL entspricht dem Standard-Schema zoom/x/y", () => {
    expect(MAP_PROVIDERS.osm.xyzTileUrl!(12, 34, 56)).toBe(
      "https://tile.openstreetmap.org/12/34/56.png"
    );
  });

  it("Esri-Tile-URL entspricht dem ArcGIS-Schema zoom/y/x (vertauscht)", () => {
    expect(MAP_PROVIDERS.esri.xyzTileUrl!(12, 34, 56)).toBe(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/56/34"
    );
  });

  it("mapProviderIdForSatelliteFlag(false) liefert osm", () => {
    expect(mapProviderIdForSatelliteFlag(false)).toBe("osm");
  });

  it("mapProviderIdForSatelliteFlag(true) liefert rlp_dop20 (nicht esri)", () => {
    expect(mapProviderIdForSatelliteFlag(true)).toBe("rlp_dop20");
  });

  it("osm ist für alle Tarife nutzbar, esri/rlp_dop20 erfordern Pro", () => {
    expect(MAP_PROVIDERS.osm.requiresPro).toBe(false);
    expect(MAP_PROVIDERS.esri.requiresPro).toBe(true);
    expect(MAP_PROVIDERS.rlp_dop20.requiresPro).toBe(true);
  });

  describe("providerCoversPoint", () => {
    it("Provider ohne coverage (osm) deckt jeden Punkt ab", () => {
      expect(providerCoversPoint(MAP_PROVIDERS.osm, 10, 10)).toBe(true);
      expect(providerCoversPoint(MAP_PROVIDERS.osm, -80, 170)).toBe(true);
    });

    it("rlp_dop20 deckt einen Punkt in Mainz ab", () => {
      expect(providerCoversPoint(MAP_PROVIDERS.rlp_dop20, 49.9929, 8.2473)).toBe(true);
    });

    it("rlp_dop20 deckt Berlin nicht ab", () => {
      expect(providerCoversPoint(MAP_PROVIDERS.rlp_dop20, 52.52, 13.405)).toBe(false);
    });

    it("Randfälle der Bounding Box liegen innerhalb", () => {
      const b = MAP_PROVIDERS.rlp_dop20.coverage!;
      expect(providerCoversPoint(MAP_PROVIDERS.rlp_dop20, b.north, b.east)).toBe(true);
      expect(providerCoversPoint(MAP_PROVIDERS.rlp_dop20, b.south, b.west)).toBe(true);
    });
  });

  describe("buildWmsGetMapUrl", () => {
    it("baut eine korrekte GetMap-URL mit allen Pflichtparametern", () => {
      const url = buildWmsGetMapUrl(
        MAP_PROVIDERS.rlp_dop20.wms!,
        [100, 200, 300, 400],
        900,
        450.4
      );
      expect(url.startsWith("https://geo4.service24.rlp.de/wms/rp_dop20.fcgi?")).toBe(true);
      const params = new URLSearchParams(url.split("?")[1]);
      expect(params.get("SERVICE")).toBe("WMS");
      expect(params.get("REQUEST")).toBe("GetMap");
      expect(params.get("VERSION")).toBe("1.1.1");
      expect(params.get("LAYERS")).toBe("rp_dop20");
      expect(params.get("SRS")).toBe("EPSG:3857");
      expect(params.get("BBOX")).toBe("100.00,200.00,300.00,400.00");
      expect(params.get("WIDTH")).toBe("900");
      expect(params.get("HEIGHT")).toBe("450"); // gerundet
    });
  });
});
