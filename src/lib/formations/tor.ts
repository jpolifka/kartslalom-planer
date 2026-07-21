// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

// "Tor": die atomare Grundeinheit fast aller anderen Formationen — zwei Pylonen im Abstand
// einer Standard-Gassenbreite (LANE_SPACING, 1,65 m lichte Breite), die das Kart passieren
// muss. Alle komplexeren Formationen (Ecken, Slalom, Kreisel, ...) reihen letztlich solche
// Tore/Gassen aneinander.
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
