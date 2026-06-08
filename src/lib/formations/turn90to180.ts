import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

export const turn90to180: FormationDefinition = {
  key: "turn90to180",
  label: "Wende 90-180 Grad",
  description: "Pyramide aus drei stehenden Pylonen ohne Abstand.",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0, 0).standing()
      .move_pylon(0.4,0).standing()
      .at(0,0).move_pylon(0.2,0.4).standing()
      .points()
  ),
};
