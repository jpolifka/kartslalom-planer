// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect, beforeEach } from "vitest";
import { saveState, loadState, clearSavedState, parseImportFile } from "./storage";

const STORAGE_KEY = "kartslalom_autosave";
const CURRENT_VERSION = 1;

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

describe("saveState / loadState", () => {
  it("save/load roundtrip", () => {
    saveState(baseState);
    const loaded = loadState();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(CURRENT_VERSION);
    expect(loaded!.manualWidth).toBe(20);
    expect(loaded!.items).toEqual([]);
  });

  it("returns null when storage is empty", () => {
    expect(loadState()).toBeNull();
  });

  it("returns null on version mismatch", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...baseState, version: 99 }));
    expect(loadState()).toBeNull();
  });

  it("returns null on corrupt JSON", () => {
    localStorage.setItem(STORAGE_KEY, "not-json{{{");
    expect(loadState()).toBeNull();
  });
});

describe("clearSavedState", () => {
  it("removes saved state from localStorage", () => {
    saveState(baseState);
    expect(loadState()).not.toBeNull();
    clearSavedState();
    expect(loadState()).toBeNull();
  });

  it("does not throw when storage is already empty", () => {
    expect(() => clearSavedState()).not.toThrow();
  });
});

describe("parseImportFile", () => {
  const validExport = JSON.stringify({ ...baseState, version: CURRENT_VERSION });

  it("parses valid export JSON", () => {
    const result = parseImportFile(validExport);
    expect(result.version).toBe(CURRENT_VERSION);
    expect(result.items).toEqual([]);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseImportFile("{{not json}}")).toThrow("kein gültiges JSON");
  });

  it("throws on wrong version", () => {
    const wrongVersion = JSON.stringify({ ...baseState, version: 99 });
    expect(() => parseImportFile(wrongVersion)).toThrow("Inkompatible Version");
  });

  it("throws when items is missing", () => {
    const noItems = JSON.stringify({ version: CURRENT_VERSION, arrows: [] });
    expect(() => parseImportFile(noItems)).toThrow("Fehlende Streckendaten");
  });

  it("throws when arrows is missing", () => {
    const noArrows = JSON.stringify({ version: CURRENT_VERSION, items: [] });
    expect(() => parseImportFile(noArrows)).toThrow("Fehlende Streckendaten");
  });

  it("throws when input is not an object", () => {
    expect(() => parseImportFile(JSON.stringify(null))).toThrow("Ungültiges Dateiformat");
  });
});
