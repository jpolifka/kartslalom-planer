// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

// "Gasse": die einfachste Grundformation — zwei parallele Pylonenreihen im Abstand einer
// Standard-Fahrgasse (move_lane), die gemeinsam eine gerade Durchfahrt bilden. Der 0,35-fache
// Pylonenabstand (statt 1,0) zwischen den drei Pylonen je Seite ist bewusst enger als der
// Regelabstand, damit die Reihe optisch als durchgehende "Wand" statt als einzelne Torpylonen
// wirkt.
export const gasse: FormationDefinition = {
  key: "gasse",
  label: "Gasse",
  description: "Drei Pylonen je Seite, eine Spurbreite.",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0, 0).standing()
      .move_pylon(0, 0.35).standing()
      .move_pylon(0, 0.35).standing()
      .at(0, 0).move_lane(1, 0).standing()
      .move_pylon(0, 0.35).standing()
      .move_pylon(0, 0.35).standing()
      .points()
  ),
};
