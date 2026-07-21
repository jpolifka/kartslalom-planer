// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

// "Schneckenhaus": eine spiralfoermige Anordnung aus mehreren parallelen kurzen Pylonen-
// reihen (je 4 Pylonen), die mit wachsendem Lane-Abstand nach außen "aufgewickelt" werden
// und am Ende in eine laengere Verbindungsreihe (die "Schale") uebergehen. Weil die
// Reihenfolge der Ein-/Ausfahrten frei waehlbar ist (siehe description), gibt es keine feste
// "Start"-Pylone in der Geometrie — die Formation ist bewusst richtungsneutral aufgebaut.
export const snail: FormationDefinition = {
  key: "snail",
  label: "Schneckenhaus",
  description: "Die Reihenfolge der Ein- und Ausfahrten kann beliebig gewaehlt werden. Das Schneckenhaus kann von innen nach aussen oder auch umgekehrt befahren werden. Auch ein spiegelbildlicher Aufbau ist moeglich.",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0,0).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      
      .at(0,0).move_lane(1,0).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()

      .at(0,0).move_lane(2,0).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()

      .at(0,0).move_lane(2,0).move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()   
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()

      .at(0,0).move_lane(3,0).move_pylon(5,0).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      
      .points()
  ),
};
