// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

// "Kasten" (Box): ein rechteckiger Fahrkorridor aus zwei parallelen Pylonenreihen, den das
// Kart entweder gerade durchfaehrt (boxStraight) oder in dem es an einem Ende um 90° abbiegen
// muss (boxTurn). Die kurzen Endstuecke (move_lane) markieren die Ein-/Ausfahrt in Gassenbreite,
// die Laengsseiten bestehen aus einzelnen Pylonen im Pylonenabstand (move_pylon).
export const boxStraight: FormationDefinition = {
  key: "boxStraight",
  label: "Kasten Durchfahrt",
  description: "",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_lane(1,0).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .move_lane(-1,0).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      .points()
      
  ),
};

export const boxTurn: FormationDefinition = {
  key: "boxTurn",
  label: "Kasten Kurve",
  description: "Kasten-Kurve gemaess deiner ASCII-Skizze.",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0,0).standing()
      // Faktor 1,1 statt 1,0 auf den Pylonenabstand (also ca. 0,88 m statt 0,80 m):
      // etwas großzügigerer Abstand an der Kurven-Außenseite, damit das Kart trotz
      // größerem Wenderadius nicht an die Pylonen kommt.
      .move_pylon(1.1,0).standing()
      .move_pylon(1.1,0).standing()
      .move_pylon(1.1,0).standing()
      .move_pylon(1.1,0).standing()
      .move_lane(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .move_lane(-1,0).standing()
      .move_pylon(0,-1.1).standing()
      .move_pylon(0,-1.1).standing()
      .move_pylon(0,-1.1).standing()     
      .points()
  ),
};
