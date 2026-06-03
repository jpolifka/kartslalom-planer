import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { meter, standing } from "./common";

export const wechselzone: FormationDefinition = {
  key: "wechselzone",
  label: "Wechselzone",
  description: "3×3 m Wechselzone mit Einfahrtslinie.",
  defaultDirection: "none",
  hasStartLine: true,
  hasFinishLine: true,
  areaLabel: "Wechsel",
  areaColor: "#bfdbfe",
  cones: normalizeCones([
    standing(0, 0),
    standing(meter(3), 0),
    standing(0, meter(3)),
    standing(meter(3), meter(3)),
  ]),
};
