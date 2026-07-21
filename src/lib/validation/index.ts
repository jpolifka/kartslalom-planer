// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { PlacedFormation } from "../../types";
import { buildWorldCones, validateGeometry } from "./geometry";
import { validateTrack } from "./track";
import type { ValidationContext, ValidationIssue } from "./types";

// Einstiegspunkt der Streckenprüfung ("Prüfung"-Sektion in App.tsx): kombiniert
// die rein geometrische Prüfung (geometry.ts) mit der Fahrfluss-/Streckenlogik
// (track.ts) zu einer gemeinsamen Liste von Fehlern/Hinweisen. Neue Prüfregeln
// werden in einer der beiden Teilprüfungen ergänzt, nicht hier (siehe docs/validierung.md).
export function runValidation(fieldWidth: number, fieldLength: number, items: PlacedFormation[]): ValidationIssue[] {
  const worldCones = buildWorldCones(items);
  const ctx: ValidationContext = {
    fieldWidth,
    fieldLength,
    items,
    worldCones,
  };

  return [
    ...validateGeometry(ctx),
    ...validateTrack(ctx),
  ];
}
