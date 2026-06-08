import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

export const pretzel: FormationDefinition = {
  key: "pretzel",
  label: "Brezel / Knoten / Schwammerl",
  description: "Geometrie direkt aus deiner textlichen Aufbauanweisung modelliert.",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0, 0).standing()
      .move_pylon(1.05,0).standing()
      .move_pylon(1.05,0).standing()
      .move_pylon(1.05,0).standing()
      .move_pylon(1.05,0).standing()
      .move_pylon(1.05,0).standing()
      .move_pylon(1.05,0).standing()
      .move_pylon(1.05,0).standing()
      .move_pylon(1.05,0).standing()
      .move_pylon(1.05,0).standing()
      .move_lane(0,1).standing()

      .at(0,0).move_lane(0,1).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0.5).standing("normal",45)
      .move_pylon(0.5,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_lane(1,0).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0.5,-1).standing("normal",45)
      .move_pylon(1,-0.5).standing()
      .move_pylon(1,0).standing()
      
      .points()
  ),
};
