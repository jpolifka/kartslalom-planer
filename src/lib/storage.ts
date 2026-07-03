// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { AreaSelection } from "./areaSelection";
import type { PlacedArrow, PlacedFormation } from "../types";

const STORAGE_KEY = "kartslalom_autosave";
const CURRENT_VERSION = 1;

// Stellt sicher, dass jede PlacedFormation mit key='custom' ein customSnapshot hat.
// Schützt vor alten Saves und importierten Dateien ohne Snapshot.
export function sanitizeItems(items: unknown[]): PlacedFormation[] {
  return (items as PlacedFormation[]).map((item) => {
    if (item.key === "custom" && !item.customSnapshot) {
      return { ...item, customSnapshot: { cones: [], arrows: [], label: "⚠ Fehlendes Hindernis" } };
    }
    return item;
  });
}

export type SavedState = {
  version: number;
  name?: string;
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
    return { ...parsed, items: sanitizeItems(parsed.items ?? []) };
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
  const safeName = state.name?.trim().replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, "").slice(0, 50);
  a.download = safeName
    ? `kartslalom_${safeName}_${new Date().toISOString().slice(0, 10)}.json`
    : `kartslalom_${new Date().toISOString().slice(0, 10)}.json`;
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
  return { ...(p as unknown as SavedState), items: sanitizeItems(p.items) };
}
