// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// Smoke-Tests für runValidation() (geometry.ts + track.ts kombiniert) —
// prüft nur die Fehler-Ebene ("error"), nicht die zahlreichen "warning"/"info"-
// Hinweise (Vorstartbereich, Wechselzone etc.), die bei einer derart minimalen
// Testfläche erwartbar mit auftreten.

import { describe, it, expect } from "vitest";
import { runValidation } from "./index";
import type { PlacedFormation } from "../../types";

// Minimal-Helper für einen einzelnen Standard-Pylon ohne Rotation — reicht aus,
// um die geometrischen Abstands-/Grenzprüfungen gezielt auszulösen.
function pylon(id: string, x: number, y: number): PlacedFormation {
  return { id, key: "singlePylon", x, y, rotationDeg: 0, direction: "none" };
}

describe("validation", () => {
  it("valid track has no errors", () => {
    // Single pylon well within a large field — no geometry errors expected.
    // Track-level warnings (missing vorstartbereich etc.) may be present but no errors.
    const items: PlacedFormation[] = [pylon("p1", 10, 10)];
    const issues = runValidation(100, 200, items);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("pylon too close creates warning", () => {
    // Two singlePylons 0.1 m apart → world-cone distance 0.1 m < 0.2 m threshold
    const items: PlacedFormation[] = [
      pylon("p1", 0, 0),
      pylon("p2", 0.1, 0),
    ];
    const issues = runValidation(100, 200, items);
    const overlap = issues.filter((i) => i.id.startsWith("cone-overlap"));
    expect(overlap.length).toBeGreaterThan(0);
    expect(overlap[0].severity).toBe("warning");
  });
});
