// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { AreaSelection } from "./areaSelection";
import type { PlacedArrow, PlacedFormation } from "../types";

const STORAGE_KEY = "kartslalom_autosave";
const CURRENT_VERSION = 1;

export type SavedState = {
  version: number;
  items: PlacedFormation[];
  arrows: PlacedArrow[];
  manualWidth: number;
  manualLength: number;
  mapSatellite: boolean;
  mapOpacity: number;
  areaSel: AreaSelection | null;
};

export function saveState(state: Omit<SavedState, "version">): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: CURRENT_VERSION }));
  } catch {
    // quota exceeded or private browsing
  }
}

export function loadState(): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedState;
    if (parsed.version !== CURRENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSavedState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function exportAsFile(state: Omit<SavedState, "version">): void {
  const data = JSON.stringify({ ...state, version: CURRENT_VERSION }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kartslalom_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseImportFile(json: string): SavedState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Datei ist kein gültiges JSON.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Ungültiges Dateiformat.");
  const p = parsed as Record<string, unknown>;
  if (p.version !== CURRENT_VERSION) throw new Error(`Inkompatible Version (erwartet: ${CURRENT_VERSION}).`);
  if (!Array.isArray(p.items) || !Array.isArray(p.arrows)) throw new Error("Fehlende Streckendaten.");
  return p as unknown as SavedState;
}
