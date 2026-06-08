import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

export const swissSlalom: FormationDefinition = {
  key: "swissSlalom",
  label: "Schweizer Slalom",
  description: "Ein Slalom-Block mit wechselnden Richtungsdreiecken.",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0, 0).standing()
      .move_pylon_height(-1, 0).lying(90)
      .points()
  ),
};
