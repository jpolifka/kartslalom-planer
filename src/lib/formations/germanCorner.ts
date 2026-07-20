// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.


import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

// "Deutsches Eck": eine rechtwinklige Ecke aus zwei je 5 Pylonen langen Außenarmen (oben und
// rechts, mit gemeinsamer Eckpylone), die eine 90°-Wende erzwingt. Die zweite, um eine
// Gassenbreite nach innen versetzte Pylonenreihe (ab dem zweiten .at(0,0)) markiert die
// Innenkante der Fahrgasse; die letzte Pylone steht im 45°-Winkel und kennzeichnet den
// Einlenkpunkt/die Ideallinie in die Kurve.
export const germanCorner: FormationDefinition = {
  key: "germanCorner",
  label: "Deutsches Eck",
  description: "Deutsches Eck: je 5 Pylonen pro Arm im 0,5m-Abstand (Kante zu Kante), Torbreite 1,65 m (lichte Breite).",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      // äußere Kante: oben (A1 - A6) und rechts (A6 - C6), gemeinsame Eckpylone A6
      .at(0, 0).standing()
      .move_pylon(1, 0).standing()
      .move_pylon(1, 0).standing()
      .move_pylon(1, 0).standing()
      .move_pylon(1, 0).standing()
      .move_pylon(1, 0).standing()
      .move_pylon(0, 1).standing()
      .move_pylon(0, 1).standing()
      .move_pylon(0, 1).standing()
      .move_pylon(0, 1).standing()
      .move_pylon(0, 1).standing()
      .move_lane(-1,0).standing()
      .move_pylon(0,-1).standing()
      .at(0,0).move_lane(0,1).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0.5).standing("normal",45)
      .points()
  ),
};
