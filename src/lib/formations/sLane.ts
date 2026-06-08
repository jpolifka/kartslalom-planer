// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

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
