// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect } from "vitest";
import { MAP_PROVIDERS, mapProviderForSatelliteFlag } from "./mapProviders";

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

  it("mapProviderForSatelliteFlag(false) liefert osm", () => {
    expect(mapProviderForSatelliteFlag(false).id).toBe("osm");
  });

  it("mapProviderForSatelliteFlag(true) liefert esri", () => {
    expect(mapProviderForSatelliteFlag(true).id).toBe("esri");
  });

  it("osm ist für alle Tarife nutzbar, esri erfordert Pro", () => {
    expect(MAP_PROVIDERS.osm.requiresPro).toBe(false);
    expect(MAP_PROVIDERS.esri.requiresPro).toBe(true);
  });
});
