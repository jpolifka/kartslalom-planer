// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

// "S-Spurgasse": zwei parallele Fahrspuren (obere/untere Reihe), die jeweils in der Mitte
// um einen halben Pylonenabstand (0,5-facher Faktor statt 1,0) seitlich versetzt werden.
// Dadurch macht die Gasse insgesamt einen leichten S-Schlag, bleibt aber durchgehend
// befahrbar (kein harter Winkel wie bei der Schikane).
export const sLane: FormationDefinition = {
  key: "sLane",
  label: "S-Spurgasse",
  description: "Fahrspurbreite = Spurbreite + 40 cm Pylonenabstand = 50 cm",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      //Obere Fahrspur
      .at(0, 0).standing()
      .move_pylon(1, 0).standing()
      .move_pylon(1, 0).standing()
      .move_pylon(1,0.5).standing()
      .move_pylon(1,0.5).standing()
      .move_pylon(1,0.5).standing()
      .move_pylon(1,0.5).standing()
      .move_pylon(1,0.5).standing()
      .move_pylon(1,0.5).standing()
      .move_pylon(1, 0).standing()
      .move_pylon(1, 0).standing()
      // Untere Fahrspur
      .at(0,0)
      .move_lane(0,1).standing()
      .move_pylon(1, 0).standing()
      .move_pylon(1, 0).standing()
      .move_pylon(1,0.5).standing()
      .move_pylon(1,0.5).standing()
      .move_pylon(1,0.5).standing()
      .move_pylon(1,0.5).standing()
      .move_pylon(1,0.5).standing()
      .move_pylon(1,0.5).standing()
      .move_pylon(1, 0).standing()
      .move_pylon(1, 0).standing()
      .points()
),
};
