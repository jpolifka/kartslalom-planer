// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect } from "vitest";
import { generateTrackSVG } from "./exportSVG";
import type { PlacedFormation } from "../types";

const snap = {
  cones: [
    { id: "c1", x: 0, y: 0, kind: "standing" as const, angleDeg: 0 },
    { id: "c2", x: 1, y: 0, kind: "standing" as const, angleDeg: 0 },
  ],
  arrows: [],
  label: "Mein Slalom-Bogen",
};

function customItem(extra: Partial<PlacedFormation> = {}): PlacedFormation {
  return {
    id: "pf1", key: "custom",
    x: 5, y: 5, rotationDeg: 0, direction: "none",
    customFormationId: "cf-deleted",
    customSnapshot: snap,
    ...extra,
  };
}

// H5: SVG-Export mit gelöschter Quelle — customSnapshot muss ausreichen
describe("generateTrackSVG mit customSnapshot", () => {
  it("wirft keinen Fehler wenn Quelle gelöscht (nur customSnapshot vorhanden)", () => {
    expect(() =>
      generateTrackSVG(18, 36, [customItem()], [])
    ).not.toThrow();
  });

  it("SVG enthält den Snapshot-Label als Text", () => {
    const svg = generateTrackSVG(18, 36, [customItem()], []);
    expect(svg).toContain("Mein Slalom-Bogen");
  });

  it("SVG enthält Cones aus dem Snapshot", () => {
    const svg = generateTrackSVG(18, 36, [customItem()], []);
    // stehendes Pylone = rect-Element (kein circle)
    expect(svg).toContain("<rect");
  });

  it("wirft keinen Fehler bei fehlendem Snapshot (Fallback-Platzhalter)", () => {
    const item: PlacedFormation = {
      id: "pf2", key: "custom",
      x: 3, y: 3, rotationDeg: 0, direction: "none",
    };
    expect(() =>
      generateTrackSVG(18, 36, [item], [])
    ).not.toThrow();
  });

  it("Fallback-Platzhalter enthält Warnung im Label", () => {
    const item: PlacedFormation = {
      id: "pf2", key: "custom",
      x: 3, y: 3, rotationDeg: 0, direction: "none",
    };
    const svg = generateTrackSVG(18, 36, [item], []);
    expect(svg).toContain("Unbekanntes Hindernis");
  });

  it("rotiertes customSnapshot wird ohne Fehler gerendert", () => {
    expect(() =>
      generateTrackSVG(18, 36, [customItem({ rotationDeg: 45 })], [])
    ).not.toThrow();
  });

  it("gemischter Track (standard + custom) wird korrekt gerendert", () => {
    const standard: PlacedFormation = {
      id: "pf3", key: "singlePylon",
      x: 2, y: 2, rotationDeg: 0, direction: "none",
    };
    expect(() =>
      generateTrackSVG(18, 36, [standard, customItem()], [])
    ).not.toThrow();
  });

  it("SVG ist valides XML (öffnet und schließt svg-Tag)", () => {
    const svg = generateTrackSVG(18, 36, [customItem()], []);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain("</svg>");
  });
});
