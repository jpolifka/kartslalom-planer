// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

// "Schweizer Slalom": Baustein aus einer stehenden Pylone plus einem liegenden Richtungs-
// pylon (90° gedreht), der einen Pylonenhoehen-Abstand (move_pylon_height, nicht Pylonen-
// abstand!) davor liegt. Erst durch mehrfaches Platzieren dieses Blocks im Editor mit
// wechselnder Ausrichtung entsteht der eigentliche Slalom mit alternierenden
// Richtungsdreiecken — die einzelne Formation hier ist nur ein Segment davon.
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
