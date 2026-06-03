export type DirectionMode = "cw" | "ccw" | "none";

export type ConeKind = "standing" | "lying" | "sensor";

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
  | "wechselzone";

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
