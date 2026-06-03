
import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

export const germanCorner: FormationDefinition = {
  key: "germanCorner",
  label: "Deutsches Eck",
  description: "Deutsches Eck: je 5 Pylonen pro Arm im 0,5m-Abstand, Torbreite 1,65 m.",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0, 0).standing()      
      .move_lane(1,0).standing()
      .move_pylon(0,-1).standing()
      .move_lane(-1,0).standing()
      .move_pylon(0,-1).standing()
      .move_lane(1,0).move_pylon(0.5,0).standing()
      .move_pylon(1,-0.5).standing()
      .move_pylon(1,0).standing()
      .move_lane(0,-1).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-0.8,0).standing()
      .move_pylon(0,0.9).standing()
      .move_pylon(0,0.9).standing()
      .move_pylon(0,0.9).standing()
      .points()
      
  ),
};
