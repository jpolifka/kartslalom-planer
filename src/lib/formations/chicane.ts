// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

// Schikane: eine Fahrgasse, die per Pylonenreihe seitlich versetzt wird, sodass das Kart
// einen S-Schlag fahren muss statt geradeaus durchzufahren. Die lange Pylonenreihe (8x
// move_pylon) bildet die Versatzstrecke, die abschließenden zwei Pylonen (ab .at(0,0) erneut
// gesetzt) markieren einen zusätzlichen Bezugspunkt/Versatz-Pylon fuer die Darstellung.
export const chicane: FormationDefinition = {
  key: "chicane",
  label: "Schikane",
  description: "Schikane",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0, 0).standing()
      .move_lane(0,1).standing()

      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()      
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      .move_lane(0,-1).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .at(0,0)
      .move_pylon(4,1).standing()
      .move_pylon(0,1).standing()
      .points()
  ),
};
