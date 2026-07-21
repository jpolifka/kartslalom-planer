// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

// "Normales Eck": einfache 90°-Ecke aus zwei kurzen Armen (je Faktor 1,2 auf den
// Pylonenabstand statt Standard 1,0, also etwas weiter auseinander), verbunden durch die
// Gasse (move_lane), die den eigentlichen Kurvenradius fuers Kart offen laesst — im
// Gegensatz zum "Deutschen Eck" gibt es hier keine durchgezogene Pylonenreihe entlang der
// Kurve, nur die vier Eckpunkte.
export const normalCorner: FormationDefinition = {
  key: "normalCorner",
  label: "Normales Eck",
  description: "Normales Eck: 3 Pylonen je Arm im 0,5m-Abstand, Torbreite 1,65 m.",
  defaultDirection: "none",
  cones: normalizeCones(
      builder()
        .at(0,0).standing()
        .move_pylon(1.2,0).standing()
        .move_pylon(1.2,0).standing()
        .move_lane(0,1).standing()
        .move_lane(-1,0).standing()
        .move_pylon(0,-1.2).standing()
        .points()
    ),
};

// Variante mit gerundetem statt rechtwinkligem Kurvenverlauf: drei zusaetzliche Pylonen
// nach der Ecke, deren Winkel (angleDeg) in 10°-Schritten von 55° auf 25° abnimmt und so
// eine gebogene "Ideallinie" andeutet, statt einer scharfen 90°-Kante.
export const normalCornerAlt: FormationDefinition = {
  key: "normalCornerAlt",
  label: "Normales Eck (gerundet)",
  description: "Gerundetes Eck mit gebogener Pylonenlinie, Torbreite 1,65 m.",
  defaultDirection: "none",
  cones: normalizeCones(
      builder()
        .at(0,0).standing().move_lane(1,0).standing()
        .at(0,0).move_lane(0,1).standing()
        .move_pylon(0.9,-0.25).standing("normal",55)
        .move_pylon(0.9,-0.55).standing("normal",45)
        .move_pylon(0.5,-0.9).standing("normal",25)
        .points()
    ),
};
