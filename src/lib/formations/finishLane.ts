// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

export const finishLane: FormationDefinition = {
  key: "finishLane",
  label: "Ziel (Gasse)",
  description: "2,5m breite Zielgasse, 8m lang, Pylonenabstand 50cm, Strich an Einfahrt und Ausfahrt.",
  defaultDirection: "none",
  // Beide Striche gesetzt, weil die Zielgasse an Einfahrt UND Ausfahrt je eine Linie
  // braucht ("Strich an Einfahrt und Ausfahrt" laut Beschreibung) — nicht weil hier
  // gleichzeitig gestartet und gezielt wird.
  hasStartLine: true,
  hasFinishLine: true,
  cones: normalizeCones(
    builder()
      // Linke Seite (y = 0 → 8m)
      .at(0, 0).standing()
      .move_pylon(0, 1).standing()
      .move_pylon(0, 1).standing()
      .move_pylon(0, 1).standing()
      .move_pylon(0, 1).standing()
      .move_pylon(0, 1).standing()
      .move_pylon(0, 1).standing()
      .move_pylon(0, 1).standing()
      .move_pylon(0, 1).standing()
      .move_pylon(0, 1).standing()
      .move_pylon(0, 1).standing()
      
      // Rechte Seite (y = 8m → 0)
      .move_meter(2.5, 0).standing()
      .move_pylon(0, -1).standing()
      .move_pylon(0, -1).standing()
      .move_pylon(0, -1).standing()
      .move_pylon(0, -1).standing()
      .move_pylon(0, -1).standing()
      .move_pylon(0, -1).standing()
      .move_pylon(0, -1).standing()
      .move_pylon(0, -1).standing()
      .move_pylon(0, -1).standing()
      .move_pylon(0, -1).standing()
      .points()
  ),
};
