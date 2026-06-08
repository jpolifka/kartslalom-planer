
import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder, PYLON_SPACING, LANE_SPACING } from "./common";

// Die innere Treppenkante verläuft parallel zur äußeren L-Kante im konstanten
// Abstand der lichten Torbreite (1,65 m). Die beiden Übergangs-Pylonen schließen
// die Treppe geometrisch exakt: ihr diagonaler Versatz ergibt sich daraus, dass
// vier reguläre Pylonenabstände (0,5 m) die lichte Torbreite (1,65 m) überbrücken
// müssen – symmetrisch auf die beiden Diagonalschritte verteilt.
const DIAGONAL_STEP = (4 * PYLON_SPACING - LANE_SPACING) / 2;

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
      // innere Treppenkante: startet im Abstand der lichten Torbreite (1,65 m)
      // unterhalb der oberen linken Eckpylone
      .at(0, 0).move_lane(0, 1).standing()
      .move_pylon(1, 0).standing()
      .move_meter(DIAGONAL_STEP, DIAGONAL_STEP).standing()
      .move_meter(DIAGONAL_STEP, DIAGONAL_STEP).standing()
      .move_pylon(0, 1).standing()
      .points()
  ),
};
