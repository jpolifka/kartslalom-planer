// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationKey } from "../../types";

export const FORMATION_GROUPS: Array<{ key: string; label: string; formations: FormationKey[]; rotationSubMenu?: boolean }> = [
  { key: "startziel", label: "Start / Ziel", formations: ["startGate", "finishLane", "vorstartbereich", "wechselzone"] },
  { key: "basis", label: "Basis", formations: ["singlePylon", "turn90to180", "tor", "gasse", "swissSlalom", "switchGate", "sLane"] },
  { key: "kurven", label: "Kurven", formations: ["normalCorner", "normalCornerAlt", "germanCorner", "circle"], rotationSubMenu: true },
  { key: "komplex", label: "Komplex", formations: ["zLane", "boxStraight", "boxTurn", "snail", "cross", "pretzel", "chicane", "ypsilon"] },
];
