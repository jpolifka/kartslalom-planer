// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect, beforeEach } from "vitest";
import { saveState, loadState, clearSavedState, parseImportFile, sanitizeItems } from "./storage";
import type { PlacedFormation } from "../types";

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

  it("custom formation with valid snapshot passes through unchanged", () => {
    const snap = { cones: [], arrows: [], label: "Mein Hindernis" };
    const json = JSON.stringify({
      ...baseState, version: CURRENT_VERSION,
      items: [{ id: "x", key: "custom", x: 0, y: 0, rotationDeg: 0, direction: "none", customSnapshot: snap }],
    });
    const result = parseImportFile(json);
    expect(result.items[0].customSnapshot).toEqual(snap);
  });

  it("custom formation without snapshot is sanitized with placeholder", () => {
    const json = JSON.stringify({
      ...baseState, version: CURRENT_VERSION,
      items: [{ id: "x", key: "custom", x: 0, y: 0, rotationDeg: 0, direction: "none" }],
    });
    const result = parseImportFile(json);
    expect(result.items[0].customSnapshot).toBeDefined();
    expect(result.items[0].customSnapshot!.label).toContain("Fehlendes Hindernis");
    expect(result.items[0].customSnapshot!.cones).toEqual([]);
    expect(result.items[0].customSnapshot!.arrows).toEqual([]);
  });

  it("non-custom formations are not affected by sanitizeItems", () => {
    const json = JSON.stringify({
      ...baseState, version: CURRENT_VERSION,
      items: [{ id: "y", key: "singlePylon", x: 1, y: 2, rotationDeg: 0, direction: "none" }],
    });
    const result = parseImportFile(json);
    expect(result.items[0].key).toBe("singlePylon");
    expect(result.items[0].customSnapshot).toBeUndefined();
  });
});

describe("sanitizeItems", () => {
  it("passthrough for standard formations", () => {
    const items: PlacedFormation[] = [
      { id: "a", key: "singlePylon", x: 0, y: 0, rotationDeg: 0, direction: "none" },
    ];
    expect(sanitizeItems(items)).toEqual(items);
  });

  it("passthrough for custom formation with snapshot", () => {
    const snap = { cones: [], arrows: [], label: "Test" };
    const items: PlacedFormation[] = [
      { id: "b", key: "custom", x: 0, y: 0, rotationDeg: 0, direction: "none", customSnapshot: snap },
    ];
    expect(sanitizeItems(items)[0].customSnapshot).toEqual(snap);
  });

  it("injects placeholder for custom formation without snapshot", () => {
    const items: PlacedFormation[] = [
      { id: "c", key: "custom", x: 0, y: 0, rotationDeg: 0, direction: "none" },
    ];
    const result = sanitizeItems(items);
    expect(result[0].customSnapshot).toBeDefined();
    expect(result[0].customSnapshot!.cones).toEqual([]);
    expect(result[0].customSnapshot!.arrows).toEqual([]);
  });

  it("preserves other fields unchanged", () => {
    const items: PlacedFormation[] = [
      { id: "d", key: "custom", x: 3, y: 7, rotationDeg: 45, direction: "cw", customFormationId: "abc" },
    ];
    const result = sanitizeItems(items);
    expect(result[0].id).toBe("d");
    expect(result[0].x).toBe(3);
    expect(result[0].rotationDeg).toBe(45);
    expect(result[0].customFormationId).toBe("abc");
  });
});

// Szenario: Nutzer hat Custom-Formation in Track platziert, Quelle wird später gelöscht.
// Der exportierte JSON-Export muss den Snapshot vollständig erhalten, damit SVG/PDF/Re-Import
// weiterhin korrekt funktioniert.
describe("customSnapshot Export-Import-Roundtrip", () => {
  const snap = {
    cones: [{ id: "c1", x: 1, y: 2, kind: "standing" as const, angleDeg: 0 }],
    arrows: [],
    label: "Mein Slalom-Bogen",
  };

  const stateWithSnap = {
    items: [{
      id: "pf1", key: "custom" as const,
      x: 5, y: 10, rotationDeg: 90, direction: "cw" as const,
      customFormationId: "cf-will-be-deleted",
      customSnapshot: snap,
    }] satisfies PlacedFormation[],
    arrows: [],
    manualWidth: 18,
    manualLength: 36,
    mapSatellite: false,
    mapOpacity: 0.5,
    areaSel: null,
  };

  it("Snapshot überlebt JSON-Export (exportAsFile-Serialisierung)", () => {
    // exportAsFile tut intern: JSON.stringify({ ...state, version: CURRENT_VERSION })
    const exported = JSON.stringify({ ...stateWithSnap, version: CURRENT_VERSION });
    const imported = parseImportFile(exported);
    expect(imported.items[0].customSnapshot).toEqual(snap);
  });

  it("Snapshot überlebt localStorage-Roundtrip", () => {
    saveState(stateWithSnap);
    const loaded = loadState();
    expect(loaded).not.toBeNull();
    expect(loaded!.items[0].customSnapshot).toEqual(snap);
  });

  it("Quelle gelöscht: Snapshot fehlt im Export → Platzhalter nach Import", () => {
    // Simuliert alten Export oder manuell entfernten Snapshot
    const exported = JSON.stringify({
      ...stateWithSnap,
      version: CURRENT_VERSION,
      items: [{ ...stateWithSnap.items[0], customSnapshot: undefined }],
    });
    const imported = parseImportFile(exported);
    expect(imported.items[0].customSnapshot).toBeDefined();
    expect(imported.items[0].customSnapshot!.label).toContain("Fehlendes Hindernis");
    expect(imported.items[0].customSnapshot!.cones).toEqual([]);
  });

  it("Positions- und Rotationsdaten bleiben nach Import erhalten", () => {
    const exported = JSON.stringify({ ...stateWithSnap, version: CURRENT_VERSION });
    const imported = parseImportFile(exported);
    const pf = imported.items[0];
    expect(pf.x).toBe(5);
    expect(pf.y).toBe(10);
    expect(pf.rotationDeg).toBe(90);
    expect(pf.direction).toBe("cw");
    expect(pf.customFormationId).toBe("cf-will-be-deleted");
  });
});
