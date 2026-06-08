// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { meter, standing } from "./common";

export const vorstartbereich: FormationDefinition = {
  key: "vorstartbereich",
  label: "Vorstartbereich",
  description: "3×3 m Vorstartbereich mit Einfahrtslinie.",
  defaultDirection: "none",
  hasStartLine: true,
  areaLabel: "Vorstart",
  areaColor: "#fef08a",
  cones: normalizeCones([
    standing(0, 0),
    standing(meter(3), 0),
    standing(0, meter(3)),
    standing(meter(3), meter(3)),
  ]),
};
