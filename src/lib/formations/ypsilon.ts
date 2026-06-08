// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

export const ypsilon: FormationDefinition = {
  key: "ypsilon",
  label: "Ypsilon",
  description: "Y-foermige Kreuzung mit drei Ausfahrten.",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,-0.45).standing()
      .move_pylon(1,-0.45).standing()
      .move_pylon(1,-0.45).standing()
      .move_pylon(1,-0.45).standing()
      .move_pylon(1,-0.45).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_lane(0,1).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()     
      
      .at(0,0)
      .move_lane(0,1).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0.45).standing()
      .move_pylon(1,0.45).standing()
      .move_pylon(1,0.45).standing()
      .move_pylon(1,0.45).standing()
      .move_pylon(1,0.45).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_lane(0,-1).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()

      .move_pylon(-1,-1).standing()
      .points()
  ),
};
