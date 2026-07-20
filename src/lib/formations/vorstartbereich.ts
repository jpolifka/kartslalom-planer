// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { meter, standing } from "./common";

// "Vorstartbereich": kein Fahr-Hindernis, sondern eine reine Flaechenmarkierung (4 Eck-
// pylonen eines 3x3 m Quadrats + areaLabel/areaColor fuers Rendering als Zone) — der Bereich,
// in dem Fahrer/Karts vor dem eigentlichen Start warten. hasStartLine zeigt die Linie an der
// Einfahrt in diesen Bereich.
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
