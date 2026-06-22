// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect } from "vitest";
import { FORMATIONS, getFormation } from "./formationRegistry";

describe("formationRegistry", () => {
  it("all keys resolve", () => {
    for (const f of FORMATIONS) {
      expect(() => getFormation(f.key)).not.toThrow();
      expect(getFormation(f.key).key).toBe(f.key);
    }
  });

  it("unique keys", () => {
    const keys = FORMATIONS.map((f) => f.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });
});
