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
      .at(0,0)
      .move_lane(1,0).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()

      .at(0,0)
      .move_lane(1,0)
      .move_meter(2.5,0).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .at(0,0)
      .move_lane(2,0)
      .move_meter(2.5,0).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()

      .at(0,0)
      .move_lane(2,0)
      .move_meter(5,0).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .at(0,0)
      .move_lane(3,0)
      .move_meter(5,0).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .points()
  ),
};
