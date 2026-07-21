// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { AreaSelection } from "./areaSelection";
import type { PlacedArrow, PlacedFormation } from "../types";
import { mapProviderIdFromLegacySatelliteFlag } from "./mapProviders";
import type { MapProviderId } from "./mapProviders";

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
  mapProviderId: MapProviderId;
  mapOpacity: number;
  areaSel: AreaSelection | null;
};

// Format vor der Boolean→Provider-ID-Migration (Kartenanbieter-Abstraktion,
// Commit 7) — bestehende localStorage-Saves und exportierte JSON-Dateien
// haben weiterhin nur ein Boolean. CURRENT_VERSION bleibt bewusst 1 (kein
// Format-Bruch, der bestehende Gast-Saves ungültig machen würde);
// normalizeSavedState() übersetzt beim Lesen transparent.
// Würde CURRENT_VERSION künftig tatsächlich erhöht (echter, nicht mehr per
// normalizeSavedState()-Migration auflösbarer Formatbruch), betrifft das
// mehrere Stellen, die synchron gehalten werden müssen:
// - loadState()/parseImportFile() vergleichen `parsed.version !== CURRENT_VERSION`
//   strikt und lehnen sonst komplett ab (kein "ist mindestens Version X"-
//   Vergleich) — ältere Saves/Exporte würden ohne eine neue, an die alte
//   Versionsnummer angepasste Normalisierungsfunktion (analog
//   normalizeSavedState) ersatzlos verworfen (loadState -> null,
//   parseImportFile -> Error "Inkompatible Version").
// - saveState()/exportAsFile() schreiben CURRENT_VERSION direkt in
//   JSON.stringify({ ...state, version: CURRENT_VERSION }) — jede neue
//   Version braucht eine eigene LegacySavedStateVN-Typdefinition plus
//   Normalisierungslogik für den Übergang von der vorherigen Version.
// - storage.test.ts hat mehrere Tests, die CURRENT_VERSION lokal duplizieren
//   (siehe dortige Konstante) und bei einer Änderung mit angepasst werden
//   müssen, sonst schlagen sie fälschlich fehl.
// Die reine Boolean→Provider-ID-Migration unten braucht das nicht: sie ist
// rückwärtskompatibel ohne Formatbruch lösbar (normalizeSavedState erkennt
// alte wie neue Form am vorhandenen Feld), daher bleibt CURRENT_VERSION
// bewusst bei 1.
type LegacySavedStateV1 = Omit<SavedState, "mapProviderId"> & { mapSatellite: boolean };

function normalizeSavedState(raw: SavedState | LegacySavedStateV1): SavedState {
  if ("mapProviderId" in raw && raw.mapProviderId) return raw;
  const { mapSatellite, ...rest } = raw as LegacySavedStateV1;
  return { ...rest, mapProviderId: mapProviderIdFromLegacySatelliteFlag(mapSatellite) };
}

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
    const parsed = JSON.parse(raw) as SavedState | LegacySavedStateV1;
    if (parsed.version !== CURRENT_VERSION) return null;
    const normalized = normalizeSavedState(parsed);
    return { ...normalized, items: sanitizeItems(normalized.items ?? []) };
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
  const normalized = normalizeSavedState(p as unknown as SavedState | LegacySavedStateV1);
  return { ...normalized, items: sanitizeItems(p.items) };
}
