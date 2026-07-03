// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition, FormationKey, PlacedFormation } from "../types";
import { normalizeCones } from "./geometry";
import { meter, standing } from "./formations/common";
import { startGate } from "./formations/startGate";
import { finishLane } from "./formations/finishLane";
import { swissSlalom } from "./formations/swissSlalom";
import { switchGate } from "./formations/switchGate";
import { turn90to180 } from "./formations/turn90to180";
import { ypsilon } from "./formations/ypsilon";
import { sLane } from "./formations/sLane";
import { zLane } from "./formations/zLane";
import { boxStraight, boxTurn } from "./formations/box";
import { snail } from "./formations/snail";
import { cross } from "./formations/cross";
import { pretzel } from "./formations/pretzel";
import { germanCorner } from "./formations/germanCorner";
import { normalCorner, normalCornerAlt } from "./formations/normalCorner";
import { chicane } from "./formations/chicane";
import { circle } from "./formations/circle";
import { tor } from "./formations/tor";
import { gasse } from "./formations/gasse";
import { vorstartbereich } from "./formations/vorstartbereich";
import { wechselzone } from "./formations/wechselzone";

const DEFAULT_DURATIONS: Partial<Record<FormationKey, number>> = {
  germanCorner: 2,
  pretzel: 9,
  switchGate: 2,
  swissSlalom: 2,
  chicane: 4,
  gasse: 2,
  normalCornerAlt: 2,
  zLane: 5,
  snail: 7,
  sLane: 1,
};

export const singlePylon: FormationDefinition = {
  key: "singlePylon",
  label: "Einzelpylone",
  description: "Nur stehende Pylone. Richtungspfeil wird spaeter als separate Markierung oder Eigenschaft gefuehrt, nicht immer fest an der Formation.",
  defaultDirection: "none",
  cones: normalizeCones([standing(meter(0), meter(0))]),
};

const RAW_FORMATIONS: FormationDefinition[] = [
  startGate,
  finishLane,
  vorstartbereich,
  wechselzone,
  singlePylon,
  tor,
  gasse,
  swissSlalom,
  switchGate,
  turn90to180,
  circle,
  ypsilon,
  sLane,
  zLane,
  boxStraight,
  boxTurn,
  snail,
  cross,
  pretzel,
  germanCorner,
  normalCorner,
  normalCornerAlt,
  chicane,
];

export const FORMATIONS: FormationDefinition[] = RAW_FORMATIONS.map((f) => ({
  ...f,
  defaultDurationSeconds: DEFAULT_DURATIONS[f.key] ?? f.defaultDurationSeconds,
}));

export function getFormation(key: FormationDefinition["key"]) {
  const item = FORMATIONS.find((formation) => formation.key === key);
  if (!item) {
    throw new Error(`Unknown formation: ${key}`);
  }
  return item;
}

export function getEffectiveDuration(durationSecondsOverride: number | undefined, key: FormationKey): number {
  if (durationSecondsOverride !== undefined) return durationSecondsOverride;
  if (key === "custom") return 0;
  return getFormation(key).defaultDurationSeconds ?? 0;
}

export function resolveFormation(pf: PlacedFormation): FormationDefinition {
  if (pf.key === "custom") {
    const snap = pf.customSnapshot;
    if (!snap) {
      // Snapshot fehlt (alter Save oder Datenfehler) — Platzhalter statt App-Crash
      return { key: "custom", label: "⚠ Unbekanntes Hindernis", description: "", cones: [] };
    }
    return { key: "custom", label: snap.label, description: "", cones: snap.cones };
  }
  return getFormation(pf.key);
}
