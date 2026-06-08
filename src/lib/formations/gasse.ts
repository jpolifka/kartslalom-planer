import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

export const gasse: FormationDefinition = {
  key: "gasse",
  label: "Gasse",
  description: "Drei Pylonen je Seite, eine Spurbreite.",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0, 0).standing()
      .move_pylon(0, 0.35).standing()
      .move_pylon(0, 0.35).standing()
      .at(0, 0).move_lane(1, 0).standing()
      .move_pylon(0, 0.35).standing()
      .move_pylon(0, 0.35).standing()
      .points()
  ),
};
