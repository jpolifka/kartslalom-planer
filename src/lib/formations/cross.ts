// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

// "Kreuz": eine kreuzfoermige Kreuzung aus zwei sich schneidenden Fahrgassen. Die vier
// Eckbloecke aus je 4-5 Pylonen (zwei Reihen ab jeweils neu gesetztem .at(0,0)-Ursprung)
// markieren die vier "inneren Ecken" der Kreuzung, sodass in der Mitte ein freier Kreuzungs-
// bereich entsteht, den das Kart aus beliebiger Richtung durchqueren kann.
export const cross: FormationDefinition = {
  key: "cross",
  label: "Kreuz",
  description: "Kreuz gemaess deiner ASCII-Skizze.",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      
      .move_lane(1,0).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()

      .at(0,0).move_lane(0,1).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()

      .move_lane(1,0).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      
      .points()
  ),
};
