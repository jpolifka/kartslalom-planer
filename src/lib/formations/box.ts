import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

export const boxStraight: FormationDefinition = {
  key: "boxStraight",
  label: "Kasten Durchfahrt",
  description: "",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_lane(1,0).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .move_lane(-1,0).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      .points()
      
  ),
};

export const boxTurn: FormationDefinition = {
  key: "boxTurn",
  label: "Kasten Kurve",
  description: "Kasten-Kurve gemaess deiner ASCII-Skizze.",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0,0).standing()
      .move_pylon(1.1,0).standing()
      .move_pylon(1.1,0).standing()
      .move_pylon(1.1,0).standing()
      .move_pylon(1.1,0).standing()
      .move_lane(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .move_lane(-1,0).standing()
      .move_pylon(0,-1.1).standing()
      .move_pylon(0,-1.1).standing()
      .move_pylon(0,-1.1).standing()     
      .points()
  ),
};
