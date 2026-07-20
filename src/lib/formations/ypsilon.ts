// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

// "Ypsilon": Y-foermige Verzweigung mit drei Ausfahrten. Zwei fast identische Pylonenreihen
// (oben/unten, Ursprung jeweils bei .at(0,0) neu gesetzt) spreizen sich in der Mitte mit
// Faktor 0,45 (statt 1,0) auseinander und laufen am Ende wieder zusammen — dieser
// V-Abschnitt bildet den namensgebenden Ypsilon-Knick. Die letzte Pylone (move_pylon(-1,-1))
// markiert den dritten, mittleren Ausgang zwischen den beiden Armen.
export const ypsilon: FormationDefinition = {
  key: "ypsilon",
  label: "Ypsilon",
  description: "Y-foermige Kreuzung mit drei Ausfahrten.",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,-0.45).standing()
      .move_pylon(1,-0.45).standing()
      .move_pylon(1,-0.45).standing()
      .move_pylon(1,-0.45).standing()
      .move_pylon(1,-0.45).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_lane(0,1).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()     
      
      .at(0,0)
      .move_lane(0,1).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0.45).standing()
      .move_pylon(1,0.45).standing()
      .move_pylon(1,0.45).standing()
      .move_pylon(1,0.45).standing()
      .move_pylon(1,0.45).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_lane(0,-1).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()

      .move_pylon(-1,-1).standing()
      .points()
  ),
};
