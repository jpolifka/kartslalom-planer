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

// Zentrale Override-Tabelle für Planungs-/Ablaufzeiten (Sekunden je
// Formation), getrennt von den geometrie-fokussierten Formationsdefinitionen
// in formations/*.ts. So können Standardzeiten für die Zeitplanung
// (z. B. bei einer Trainings-/Wettkampfplanung) an einer Stelle gepflegt
// werden, ohne die Cone-Geometrie-Module anzufassen; Formationen ohne Eintrag
// hier behalten ihr eigenes defaultDurationSeconds (falls gesetzt).
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

// Ermittelt die tatsächlich für eine platzierte Formation geltende Dauer:
// eine pro Platzierung individuell gesetzte Override-Zeit (durationSecondsOverride,
// z. B. vom Nutzer im Editor angepasst) hat immer Vorrang vor dem Formations-
// Standardwert. "custom"-Formationen haben keinen sinnvollen Standardwert
// (ihre Geometrie ist frei/individuell und kommt nicht aus dieser Registry),
// daher 0 ohne expliziten Override.
export function getEffectiveDuration(durationSecondsOverride: number | undefined, key: FormationKey): number {
  if (durationSecondsOverride !== undefined) return durationSecondsOverride;
  if (key === "custom") return 0;
  return getFormation(key).defaultDurationSeconds ?? 0;
}

// Löst eine platzierte Formation zu ihrer tatsächlich zu rendernden Geometrie
// auf. Für eingebaute Formationen (key !== "custom") ist das einfach die
// gemeinsame, unveränderliche Definition aus FORMATIONS (per Key geteilt von
// allen Platzierungen). Für "custom" trägt jede Platzierung stattdessen ihren
// eigenen customSnapshot: ein zum Zeitpunkt des Platzierens eingefrorenes
// Abbild der Cone-Geometrie/Label des vom Nutzer erstellten Hindernisses. Der
// Snapshot entkoppelt den gespeicherten Track von der veränderlichen
// Custom-Formation-Bibliothek (customFormationId verweist nur noch
// informativ auf die Quelle) — wird die Quell-Formation später bearbeitet
// oder gelöscht, bleibt der bereits platzierte Track unverändert korrekt
// renderbar. Fehlt der Snapshot (alter Save vor dessen Einführung, oder
// Datenfehler), wird ein Platzhalter statt eines App-Crashs zurückgegeben.
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
