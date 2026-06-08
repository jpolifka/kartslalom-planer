// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

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
  /** Gruppen von Formation-IDs, die jeweils einen zusammenhaengenden Streckenbereich bilden
   *  (z.B. bei "Strecke zerfaellt in getrennte Bereiche" — eine Gruppe pro Bereich). */
  formationGroups?: string[][];
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
