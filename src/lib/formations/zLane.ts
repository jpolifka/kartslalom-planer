// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

export const zLane: FormationDefinition = {
  key: "zLane",
  label: "Z-Gasse",
  description: "Drei Gassen, aktuell als parallele Grundvariante.",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0, 0).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_lane(1,0).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()

      .at(0,0).move_lane(1,0)
      .move_pylon(1.55,0).lying(90)
      .move_pylon(1.55,0).standing()
      .move_pylon(0,4)
      .move_pylon(-1.55,0).lying(90)
      .move_pylon(1.55,0).move_pylon(0,-4)
      
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_lane(1,0).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()

      .at(0,0).move_lane(1,0).move_pylon(1.55,0).move_pylon(1.55,0).move_lane(1,0)
      .move_pylon(1.55,0).lying(90)
      .move_pylon(1.55,0).standing()
      .move_pylon(0,4)
      .move_pylon(-1.55,0).lying(90)
      .move_pylon(1.55,0).move_pylon(0,-4)
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_lane(1,0).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()


      .points()
  ),
};
