import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

export const tor: FormationDefinition = {
  key: "tor",
  label: "Tor",
  description: "Zwei Pylonen mit einer Gasse Fahrabstand (1,65 m).",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0, 0).standing()
      .move_lane(1, 0).standing()
      .points()
  ),
};
