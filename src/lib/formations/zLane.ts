// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

// "Z-Gasse": soll eigentlich einen Z-foermigen Versatz zwischen drei Gassen abbilden: Laut
// description ist dies aber aktuell nur die "parallele Grundvariante" — die drei Gassen-
// Bloecke sind hier tatsaechlich alle in dieselbe Richtung (move_lane(1,0)) hintereinander
// aufgereiht statt seitlich versetzt. Innerhalb jedes Blocks markieren zwei liegende Pylonen
// (.lying(90), Faktor 1,55 auf den Pylonenabstand) ein Zwischentor quer zur Fahrtrichtung,
// das per move_pylon(0,4)/move_pylon(0,-4) umfahren wird, bevor die naechste Pylonenreihe
// weitergeht.
export const zLane: FormationDefinition = {
  key: "zLane",
  label: "Z-Gasse",
  description: "Drei Gassen, aktuell als parallele Grundvariante.",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0, 0).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_lane(1,0).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()

      .at(0,0).move_lane(1,0)
      .move_pylon(1.55,0).lying(90)
      .move_pylon(1.55,0).standing()
      .move_pylon(0,4)
      .move_pylon(-1.55,0).lying(90)
      .move_pylon(1.55,0).move_pylon(0,-4)
      
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_lane(1,0).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()

      .at(0,0).move_lane(1,0).move_pylon(1.55,0).move_pylon(1.55,0).move_lane(1,0)
      .move_pylon(1.55,0).lying(90)
      .move_pylon(1.55,0).standing()
      .move_pylon(0,4)
      .move_pylon(-1.55,0).lying(90)
      .move_pylon(1.55,0).move_pylon(0,-4)
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_lane(1,0).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()


      .points()
  ),
};
