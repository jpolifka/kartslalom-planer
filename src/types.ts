// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

export type DirectionMode = "cw" | "ccw" | "none";

export type ConeKind = "standing" | "lying" | "sensor";

// Fachliche Sonderrolle eines Pylonen innerhalb einer Formation. Aktuell tatsächlich
// verwendet werden nur "normal" (Standard-Streckenpylon) und "direction" (liegender
// Pylon als Fahrtrichtungsanzeige, siehe lying() in lib/formations/common.ts) —
// "entry"/"exit"/"groupMarker" sind für künftige Formationen reserviert, aber
// bisher an keiner Stelle im Code gesetzt oder ausgewertet.
export type ConeRole =
  | "normal"
  | "direction"
  | "entry"
  | "exit"
  | "groupMarker";

export type ConePoint = {
  x: number;
  y: number;
  kind: ConeKind;
  role?: ConeRole;
  angleDeg?: number;
};

export type ArrowKind = "straight" | "turn90" | "turn180";

export type ArrowDefinition = {
  kind: ArrowKind;
  width: number;
  height: number;
  strokeWidth: number;
  headSize: number;
};

export type FormationKey =
  | "singlePylon"
  | "tor"
  | "gasse"
  | "swissSlalom"
  | "switchGate"
  | "turn90to180"
  | "ypsilon"
  | "sLane"
  | "zLane"
  | "boxStraight"
  | "boxTurn"
  | "snail"
  | "cross"
  | "pretzel"
  | "germanCorner"
  | "normalCorner"
  | "normalCornerAlt"
  | "chicane"
  | "circle"
  | "arrowStraight"
  | "arrow90"
  | "arrow180"
  | "startGate"
  | "finishLane"
  | "vorstartbereich"
  | "wechselzone"
  | "custom";

export type FormationCategory =
  | "start_ziel"
  | "basis"
  | "kurven"
  | "komplex"
  | "individuell";

// Lebenszyklus einer eigenen Formation: "private" (nur Owner) → optional "shared"
// (gezielt an einzelne Nutzer freigegeben, siehe useShareFormation) → "submitted"
// (zur Aufnahme in die öffentliche Bibliothek eingereicht) → von einem Admin entweder
// zu "library" promotet (siehe useAdminPromoteToLibrary, erzeugt eine Kopie) oder
// "rejected". Der Statuswechsel selbst passiert serverseitig in den jeweiligen RPCs.
export type CustomFormationStatus =
  | "private"
  | "shared"
  | "submitted"
  | "library"
  | "rejected";

export type FormationDefinition = {
  key: FormationKey;
  label: string;
  description: string;
  cones: ConePoint[];
  defaultDirection?: DirectionMode;
  arrow?: ArrowDefinition;
  hasFinishLine?: boolean;
  hasStartLine?: boolean;
  defaultDurationSeconds?: number;
  areaLabel?: string;
  areaColor?: string;
};

export type PlacedFormation = {
  id: string;
  key: FormationKey;
  x: number;
  y: number;
  rotationDeg: number;
  direction: DirectionMode;
  durationSeconds?: number;
  customFormationId?: string;
  // Eingefrorene Kopie der Cones/Pfeile zum Platzierungszeitpunkt einer Custom-Formation.
  // Nötig, weil eine platzierte Formation auf der Strecke unabhängig von späteren
  // Änderungen/Löschungen der Quell-Formation (customFormationId) weiterbestehen soll —
  // die Strecke referenziert also nicht live die aktuelle Formation, sondern trägt
  // ihren eigenen Snapshot-Stand.
  customSnapshot?: {
    cones: ConePoint[];
    arrows: PlacedArrow[];
    label: string;
  };
};

export type CustomFormationDefinition = {
  id: string;
  ownerId: string | null;
  ownerUsername?: string;
  name: string;
  description?: string;
  category: FormationCategory;
  status: CustomFormationStatus;
  isLibrary: boolean;
  pylonCount: number;
  lichteBreite?: number;
  durationSeconds?: number;
  // Herkunft dieser Formation, falls sie nicht komplett neu erstellt wurde:
  // sourceFormationKey verweist auf eine mitgelieferte Standardformation (Basis für
  // "als eigene Variante speichern"), sourceCustomFormationId auf eine andere Custom-
  // Formation (Basis bei duplicateCustomFormation). Beide sind rein informativ/Audit —
  // die Cones/Arrows dieser Formation sind unabhängige Kopien, keine Referenz.
  sourceFormationKey?: FormationKey;
  sourceCustomFormationId?: string;
  cones: ConePoint[];
  arrows: PlacedArrow[];
  defaultDirection?: DirectionMode;
  createdAt: string;
  updatedAt: string;
};

export type PlacedArrow = {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  cpX: number;
  cpY: number;
};
