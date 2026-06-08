// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

export const cross: FormationDefinition = {
  key: "cross",
  label: "Kreuz",
  description: "Kreuz gemaess deiner ASCII-Skizze.",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      
      .move_lane(1,0).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()

      .at(0,0).move_lane(0,1).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()

      .move_lane(1,0).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      
      .points()
  ),
};
