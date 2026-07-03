// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect } from "vitest";
import { FORMATIONS, getFormation, getEffectiveDuration, resolveFormation } from "./formationRegistry";
import type { PlacedFormation } from "../types";

function pf(key: PlacedFormation["key"], extra: Partial<PlacedFormation> = {}): PlacedFormation {
  return { id: "x", key, x: 0, y: 0, rotationDeg: 0, direction: "none", ...extra };
}

describe("formationRegistry", () => {
  it("all keys resolve", () => {
    for (const f of FORMATIONS) {
      expect(() => getFormation(f.key)).not.toThrow();
      expect(getFormation(f.key).key).toBe(f.key);
    }
  });

  it("unique keys", () => {
    const keys = FORMATIONS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("getFormation throws for unknown key", () => {
    expect(() => getFormation("unknown" as never)).toThrow("Unknown formation");
  });
});

describe("getEffectiveDuration", () => {
  it("returns override when provided", () => {
    expect(getEffectiveDuration(42, "singlePylon")).toBe(42);
  });

  it("returns 0 for custom key", () => {
    expect(getEffectiveDuration(undefined, "custom")).toBe(0);
  });

  it("returns formation default when no override", () => {
    const formation = FORMATIONS.find((f) => f.defaultDurationSeconds !== undefined && f.defaultDurationSeconds > 0)!;
    expect(getEffectiveDuration(undefined, formation.key)).toBe(formation.defaultDurationSeconds ?? 0);
  });
});

describe("resolveFormation", () => {
  it("resolves a standard formation by key", () => {
    const result = resolveFormation(pf("singlePylon"));
    expect(result.key).toBe("singlePylon");
  });

  it("resolves a custom formation from snapshot", () => {
    const snap = { label: "Mein Hindernis", cones: [], arrows: [] };
    const result = resolveFormation(pf("custom", { customSnapshot: snap }));
    expect(result.key).toBe("custom");
    expect(result.label).toBe("Mein Hindernis");
    expect(result.cones).toEqual([]);
  });

  it("returns placeholder when custom formation has no snapshot", () => {
    const result = resolveFormation(pf("custom"));
    expect(result.key).toBe("custom");
    expect(result.label).toContain("Unbekanntes Hindernis");
    expect(result.cones).toEqual([]);
  });
});
