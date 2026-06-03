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
      .at(0, 4).standing().move_meter(1, 0).standing().move_meter(1, 0).standing().move_meter(1, 0).standing().move_meter(1, 0).standing().move_meter(1, 0).standing().move_meter(1, 0).standing().move_meter(1, 0).standing().move_meter(1, 0).standing()
      .at(4, 3).standing()
      .at(0, 2).standing().at(4, 2).standing().at(8, 2).standing()
      .at(0, 1).standing().at(8, 1).standing()
      .at(0, 0).standing().move_meter(1, 0).standing().move_meter(1, 0).standing().move_meter(1, 0).standing().move_meter(1, 0).standing().move_meter(1, 0).standing().move_meter(1, 0).standing().move_meter(1, 0).standing().move_meter(1, 0).standing()
      .points()
  ),
};
