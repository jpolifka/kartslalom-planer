import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

export const switchGate: FormationDefinition = {
  key: "switchGate",
  label: "Wechseltor",
  description: "Zwei Tore mit mittiger Richtungsmarkierung zwischen beiden Toren.",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0, 0).standing()
      .move_lane(1,0).standing()
      .move_pylon(1.25,0).lying(90)
      .move_pylon(1.25,0).standing()
      .move_lane(1,0).standing()
      .points()
  ),
};
