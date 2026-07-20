// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

// "Wende 90-180 Grad": kein Tor/keine Gasse, sondern ein einzelner Wende-/Hindernispunkt aus
// drei dicht beieinanderstehenden Pylonen (Faktoren 0,2-0,4 auf den Pylonenabstand statt 1,0,
// also deutlich unter dem Regelabstand von 0,80 m) — sie bilden eine kompakte "Pyramide", um
// die das Kart mit 90° bis 180° Lenkeinschlag herumfahren muss.
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
