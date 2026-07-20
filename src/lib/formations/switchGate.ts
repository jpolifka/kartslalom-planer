// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

// "Wechseltor": zwei aufeinanderfolgende Standard-Tore (move_lane), zwischen denen ein
// liegender Richtungspylon (90°) auf halbem Weg (1,25-facher Pylonenabstand) den
// Fahrtrichtungswechsel anzeigt — das Kart muss also nach dem ersten Tor die Fahrlinie
// wechseln, bevor es das zweite Tor durchfaehrt.
export const switchGate: FormationDefinition = {
  key: "switchGate",
  label: "Wechseltor",
  description: "Zwei Tore mit mittiger Richtungsmarkierung zwischen beiden Toren.",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0, 0).standing()
      .move_lane(1,0).standing()
      .move_pylon(1.25,0).lying(90)
      .move_pylon(1.25,0).standing()
      .move_lane(1,0).standing()
      .points()
  ),
};
