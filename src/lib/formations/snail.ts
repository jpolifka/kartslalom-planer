import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

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
