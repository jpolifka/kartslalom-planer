import type { FormationKey, PlacedFormation } from "../../types";

export type ValidationSeverity = "error" | "warning" | "info";
export type ValidationScope = "geometry" | "track";

export type ValidationIssue = {
  id: string;
  severity: ValidationSeverity;
  scope: ValidationScope;
  formationId?: string;
  formationKey?: FormationKey;
  message: string;
  details?: string;
};

export type WorldCone = {
  id: string;
  formationId: string;
  formationKey: FormationKey;
  x: number;
  y: number;
  kind: "standing" | "lying";
};

export type ValidationContext = {
  fieldWidth: number;
  fieldLength: number;
  items: PlacedFormation[];
  worldCones: WorldCone[];
};
