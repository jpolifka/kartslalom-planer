import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

export const chicane: FormationDefinition = {
  key: "chicane",
  label: "Schikane",
  description: "Schikane",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0, 0).standing()
      .move_lane(0,1).standing()

      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()      
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      .move_lane(0,-1).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .at(0,0)
      .move_pylon(4,1).standing()
      .move_pylon(0,1).standing()
      .points()
  ),
};
