// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect, beforeEach } from "vitest";
import { saveState, loadState } from "./storage";

const STORAGE_KEY = "kartslalom_autosave";

const baseState = {
  items: [],
  arrows: [],
  manualWidth: 20,
  manualLength: 40,
  mapSatellite: false,
  mapOpacity: 1,
  areaSel: null,
};

beforeEach(() => localStorage.clear());

describe("storage", () => {
  it("save/load roundtrip", () => {
    saveState(baseState);
    const loaded = loadState();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(1);
    expect(loaded!.manualWidth).toBe(20);
    expect(loaded!.manualLength).toBe(40);
    expect(loaded!.mapSatellite).toBe(false);
    expect(loaded!.items).toEqual([]);
  });

  it("corrupt JSON fallback", () => {
    localStorage.setItem(STORAGE_KEY, "not-json{{{");
    expect(loadState()).toBeNull();
  });
});
