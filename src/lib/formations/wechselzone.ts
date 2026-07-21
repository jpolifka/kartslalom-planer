// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { meter, standing } from "./common";

// "Wechselzone": wie vorstartbereich.ts eine reine 3x3 m Flaechenmarkierung (kein Pylonentor),
// diesmal fuer den Fahrer-/Kart-Wechsel in Staffel-Disziplinen. Sowohl Einfahrts- als auch
// Ausfahrtslinie sind gesetzt, weil die Zone sowohl betreten (Wechsel rein) als auch wieder
// verlassen (Wechsel raus) wird.
export const wechselzone: FormationDefinition = {
  key: "wechselzone",
  label: "Wechselzone",
  description: "3×3 m Wechselzone mit Einfahrtslinie.",
  defaultDirection: "none",
  hasStartLine: true,
  hasFinishLine: true,
  areaLabel: "Wechsel",
  areaColor: "#bfdbfe",
  cones: normalizeCones([
    standing(0, 0),
    standing(meter(3), 0),
    standing(0, meter(3)),
    standing(meter(3), meter(3)),
  ]),
};
