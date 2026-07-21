// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationKey } from "../../types";

// Gruppierung der Formations-Palette in der LeftSidebar, fachlich sortiert
// nach Einsatzzweck (nicht alphabetisch), damit Nutzer die passende Formation
// schnell in der richtigen Kategorie finden.
//  - rotationSubMenu: bei "Kurven" sind die Formationen nicht rotationssymmetrisch
//    (z.B. eine Linkskurve unterscheidet sich von einer Rechtskurve), daher bietet
//    PaletteCard hier zusätzlich ein Untermenü an, um direkt in 0/90/180/270°
//    gedrehter Variante einzufügen, statt nachträglich manuell drehen zu müssen.
//  - isCustom: "Individuell" hat bewusst eine leere formations-Liste — die Einträge
//    kommen zur Laufzeit dynamisch aus den eigenen (customFormations) und geteilten
//    (Library-)Formationen des Nutzers, nicht aus einer festen Formation-Registry.
export const FORMATION_GROUPS: Array<{ key: string; label: string; formations: FormationKey[]; rotationSubMenu?: boolean; isCustom?: boolean }> = [
  { key: "startziel", label: "Start / Ziel", formations: ["startGate", "finishLane", "vorstartbereich", "wechselzone"] },
  { key: "basis", label: "Basis", formations: ["singlePylon", "turn90to180", "tor", "gasse", "swissSlalom", "switchGate", "sLane"] },
  { key: "kurven", label: "Kurven", formations: ["normalCorner", "normalCornerAlt", "germanCorner", "circle"], rotationSubMenu: true },
  { key: "komplex", label: "Komplex", formations: ["zLane", "boxStraight", "boxTurn", "snail", "cross", "pretzel", "chicane", "ypsilon"] },
  { key: "individuell", label: "Individuell", formations: [], isCustom: true },
];
