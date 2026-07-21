// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationKey, PlacedFormation } from "../../types";

// "error" = Strecke verletzt eine harte Regel (z. B. ragt aus der Fläche heraus)
// und sollte vor dem Fahren behoben werden; "warning" = auffällig, aber nicht
// zwingend ungültig (z. B. großer Sprung im Fahrfluss); "info" = reiner Hinweis
// ohne Regelbezug (z. B. kein erkennbarer Start-/Zielbereich).
export type ValidationSeverity = "error" | "warning" | "info";
export type ValidationScope = "geometry" | "track";

// formationId/formationKey sind optional, da manche Prüfungen sich nicht auf
// eine einzelne Formation beziehen lassen (z. B. "Strecke zerfällt in mehrere
// Bereiche" oder "kein Vorstartbereich vorhanden") — die UI nutzt formationId
// nur, um bei Klick auf die Meldung die betroffene Formation zu fokussieren.
export type ValidationIssue = {
  id: string;
  severity: ValidationSeverity;
  scope: ValidationScope;
  formationId?: string;
  formationKey?: FormationKey;
  message: string;
  details?: string;
};

// Absolute Position eines einzelnen Pylons in Weltkoordinaten der Fahrfläche
// (nach Rotation/Normalisierung, siehe geometry.ts:worldPos) — Grundlage für
// alle Abstandsprüfungen zwischen Formationen.
export type WorldCone = {
  id: string;
  formationId: string;
  formationKey: FormationKey;
  x: number;
  y: number;
  kind: "standing" | "lying";
};

// Gemeinsamer Eingabe-Kontext für validateGeometry() und validateTrack() —
// worldCones wird einmalig zentral berechnet (buildWorldCones), damit beide
// Prüfungen dieselbe Cone-Normalisierung verwenden.
export type ValidationContext = {
  fieldWidth: number;
  fieldLength: number;
  items: PlacedFormation[];
  worldCones: WorldCone[];
};
