import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder, standing } from "./common";

export const startinglane: FormationDefinition = {
  key: "startinglane",
  label: "Start",
  description: "Vor der Haltelinie ist eine Zielgasse aufgebaut. Die Haltelinie ist nicht Bestandteil dieser Aufgabe. Breite = 2,5 m Länge = min. 8 m, max. 10 m Pylonenabstand = 50 cm",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0, 0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_meter(0,2.5).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .move_pylon(-1,0).standing()
      .points()
  ),
};
