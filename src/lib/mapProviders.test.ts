// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect } from "vitest";
import {
  MAP_PROVIDERS,
  mapProviderIdForSatelliteFlag,
  providerCoversBounds,
  buildWmsGetMapUrl,
} from "./mapProviders";
import type { GeoBounds } from "./geo";

describe("mapProviders", () => {
  it("OSM-Tile-URL entspricht dem Standard-Schema zoom/x/y", () => {
    expect(MAP_PROVIDERS.osm.xyzTileUrl!(12, 34, 56)).toBe(
      "https://tile.openstreetmap.org/12/34/56.png"
    );
  });

  it("mapProviderIdForSatelliteFlag(false) liefert osm", () => {
    expect(mapProviderIdForSatelliteFlag(false)).toBe("osm");
  });

  it("mapProviderIdForSatelliteFlag(true) liefert rlp_dop20", () => {
    expect(mapProviderIdForSatelliteFlag(true)).toBe("rlp_dop20");
  });

  it("osm ist für alle Tarife nutzbar, rlp_dop20 erfordert Pro", () => {
    expect(MAP_PROVIDERS.osm.requiresPro).toBe(false);
    expect(MAP_PROVIDERS.rlp_dop20.requiresPro).toBe(true);
  });

  describe("providerCoversBounds", () => {
    const boundsAround = (lat: number, lng: number, deltaDeg = 0.01): GeoBounds => ({
      lat1: lat + deltaDeg,
      lng1: lng - deltaDeg,
      lat2: lat - deltaDeg,
      lng2: lng + deltaDeg,
    });

    it("Provider ohne coverage (osm) deckt jede Envelope ab", () => {
      expect(providerCoversBounds(MAP_PROVIDERS.osm, boundsAround(10, 10))).toBe(true);
      expect(providerCoversBounds(MAP_PROVIDERS.osm, boundsAround(-80, 170))).toBe(true);
    });

    it("rlp_dop20 deckt eine kleine Envelope um Mainz vollständig ab", () => {
      expect(providerCoversBounds(MAP_PROVIDERS.rlp_dop20, boundsAround(49.9929, 8.2473))).toBe(true);
    });

    it("rlp_dop20 deckt eine Envelope um Berlin nicht ab", () => {
      expect(providerCoversBounds(MAP_PROVIDERS.rlp_dop20, boundsAround(52.52, 13.405))).toBe(false);
    });

    it("rlp_dop20 lehnt eine Envelope ab, deren Mittelpunkt innerhalb liegt, die aber über den Rand hinausragt", () => {
      const b = MAP_PROVIDERS.rlp_dop20.coverage!;
      // Mittelpunkt knapp innerhalb der Ostgrenze, Envelope ragt darüber hinaus
      const straddling: GeoBounds = {
        lat1: (b.north + b.south) / 2 + 0.01,
        lng1: b.east - 0.01,
        lat2: (b.north + b.south) / 2 - 0.01,
        lng2: b.east + 0.5,
      };
      expect(providerCoversBounds(MAP_PROVIDERS.rlp_dop20, straddling)).toBe(false);
    });

    it("Randfälle: Envelope deckungsgleich mit der Coverage-Box liegt innerhalb", () => {
      const b = MAP_PROVIDERS.rlp_dop20.coverage!;
      const exact: GeoBounds = { lat1: b.north, lng1: b.west, lat2: b.south, lng2: b.east };
      expect(providerCoversBounds(MAP_PROVIDERS.rlp_dop20, exact)).toBe(true);
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
