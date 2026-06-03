import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

export const normalCorner: FormationDefinition = {
  key: "normalCorner",
  label: "Normales Eck",
  description: "Normales Eck: 3 Pylonen je Arm im 0,5m-Abstand, Torbreite 1,65 m.",
  defaultDirection: "none",
  cones: normalizeCones(
      builder()
        .at(0,0).standing()
        .move_pylon(1.6,0).standing()
        .move_pylon(1.6,0).standing()        
        .move_lane(0,1).standing()
        .move_lane(-1,0).standing()
        .move_pylon(0,-1.6).standing()        
        .points()
    ),
};

export const normalCornerAlt: FormationDefinition = {
  key: "normalCornerAlt",
  label: "Normales Eck (gerundet)",
  description: "Gerundetes Eck mit gebogener Pylonenlinie, Torbreite 1,65 m.",
  defaultDirection: "none",
  cones: normalizeCones(
      builder()
        .at(0,0).standing()
        .move_lane(1,0).standing()
        .move_lane(-1,0)
        .move_pylon(0, 1.35).standing()
        .move_pylon(0.6, 1.35).standing()
        .move_pylon(1.35, 0.6).standing()
        .move_pylon(1.35, 0).standing()
        .points()
    ),
};
