// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { meter, sensor, standing } from "./common";

// Start: Pylonentor 4m breit, Lichtschranken-Sensoren 0,3m außerhalb der Pylonen
// Die Sensoren sitzen bewusst außerhalb der Pylonen (nicht in der Torebene), damit die
// Lichtschranke von den Torpylonen selbst nicht verdeckt/ausgeloest wird; sie sind rein
// virtuelle Zeitmesspunkte ohne physischen Pylon (siehe sensor() in common.ts).
const GATE_WIDTH = 4.0;
const SENSOR_OFFSET = 0.3;

export const startGate: FormationDefinition = {
  key: "startGate",
  label: "Start (Pylonentor + Lichtschranke)",
  description: "4m breites Pylonentor mit Lichtschranken-Sensoren beidseitig.",
  defaultDirection: "none",
  cones: normalizeCones([
    sensor(meter(0), meter(0)),
    standing(meter(SENSOR_OFFSET), meter(0)),
    standing(meter(SENSOR_OFFSET + GATE_WIDTH), meter(0)),
    sensor(meter(SENSOR_OFFSET + GATE_WIDTH + SENSOR_OFFSET), meter(0)),
  ]),
};
