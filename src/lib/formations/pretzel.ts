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
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()

      .at(0,0).move_lane(0,1).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(0.4,1).standing()
      .move_pylon(0.45,1).standing()
      .move_pylon(0.0,1).standing()
      .move_pylon(0.0,1).standing()
      .move_lane(1,0).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0.4,-1).standing()
      .move_pylon(0.45,-1).standing()
      .move_pylon(1.0,0).standing()
      .move_pylon(1.0,0).standing()
      .points()
  ),
};
