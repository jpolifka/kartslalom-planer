import type { PlacedFormation } from "../../types";
import { buildWorldCones, validateGeometry } from "./geometry";
import { validateTrack } from "./track";
import type { ValidationContext, ValidationIssue } from "./types";

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
