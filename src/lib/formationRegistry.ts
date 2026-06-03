import type { FormationDefinition, FormationKey } from "../types";
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

export const arrowStraight: FormationDefinition = {
  key: "arrowStraight",
  label: "Pfeil gerade",
  description: "Gerader Fahrtrichtungspfeil mit abgerundeten Ecken.",
  defaultDirection: "none",
  cones: [],
  arrow: {
    kind: "straight",
    width: 3.2,
    height: 1.2,
    strokeWidth: 0.28,
    headSize: 0.9,
  },
};

export const arrow90: FormationDefinition = {
  key: "arrow90",
  label: "Pfeil 90 Grad",
  description: "Abgerundeter 90-Grad-Fahrtrichtungspfeil.",
  defaultDirection: "none",
  cones: [],
  arrow: {
    kind: "turn90",
    width: 3.2,
    height: 3.2,
    strokeWidth: 0.28,
    headSize: 0.9,
  },
};

export const arrow180: FormationDefinition = {
  key: "arrow180",
  label: "Pfeil 180 Grad",
  description: "Abgerundeter 180-Grad-Wendepfeil.",
  defaultDirection: "none",
  cones: [],
  arrow: {
    kind: "turn180",
    width: 3.8,
    height: 3.4,
    strokeWidth: 0.28,
    headSize: 0.9,
  },
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
  return getFormation(key).defaultDurationSeconds ?? 0;
}
