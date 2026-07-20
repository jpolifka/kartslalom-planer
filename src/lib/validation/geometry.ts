// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// Rein geometrische Prüfungen anhand der Cone-Positionen: Ragt eine Formation über
// den Fahrflächenrand hinaus, oder stehen Pylonen unterschiedlicher Formationen
// (versehentlich) nahezu aufeinander? Enthält keine Fahrfluss-/Streckenlogik,
// das übernimmt track.ts (siehe docs/validierung.md).

import type { PlacedFormation } from "../../types";
import { boundsFromCones, rotateConesAroundOwnCenter } from "../geometry";
import { resolveFormation } from "../formationRegistry";
import type { ValidationContext, ValidationIssue, WorldCone } from "./types";

function distance(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// Weltkoordinaten eines Kegels berechnen — identisch zur Canvas-Normalisierung:
// Nach der Rotation kann bounds.minX negativ sein. Die Canvas rechnet
// cone.x - bounds.minX + 0.4 (Padding). Validierung muss dasselbe tun.
function worldPos(itemX: number, itemY: number, coneX: number, coneY: number, bounds: ReturnType<typeof boundsFromCones>) {
  return {
    x: itemX + (coneX - bounds.minX) + 0.4,
    y: itemY + (coneY - bounds.minY) + 0.4,
  };
}

export function buildWorldCones(items: PlacedFormation[]): WorldCone[] {
  return items.flatMap((item) => {
    const formation = resolveFormation(item);
    if (formation.arrow) return [];

    const rotated = rotateConesAroundOwnCenter(formation.cones, item.rotationDeg);
    const bounds = boundsFromCones(rotated);

    return rotated
      .filter((cone) => cone.kind === "standing" || cone.kind === "lying")
      .map((cone, index) => {
        const pos = worldPos(item.x, item.y, cone.x, cone.y, bounds);
        return {
          id: `${item.id}-${index}`,
          formationId: item.id,
          formationKey: item.key,
          x: pos.x,
          y: pos.y,
          kind: cone.kind as "standing" | "lying",
        };
      });
  });
}

export function validateGeometry(ctx: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const item of ctx.items) {
    const formation = resolveFormation(item);
    if (formation.arrow) {
      // Pfeile sind reine Fahrtrichtungs-Markierungen ohne Pylonen — ein Überstand
      // über den Rand ist visuell unschön, aber keine echte Regelverletzung der
      // Strecke selbst. Deshalb "warning" statt "error", anders als unten bei Formationen.
      const width = formation.arrow.width;
      const height = formation.arrow.height;
      if (item.x < 0 || item.y < 0 || item.x + width > ctx.fieldWidth || item.y + height > ctx.fieldLength) {
        issues.push({
          id: `bounds-${item.id}`,
          severity: "warning",
          scope: "geometry",
          formationId: item.id,
          formationKey: item.key,
          message: "Markierung liegt teilweise ausserhalb der Flaeche.",
        });
      }
      continue;
    }

    const rotated = rotateConesAroundOwnCenter(formation.cones, item.rotationDeg);
    const bounds = boundsFromCones(rotated);

    // Weltgrenzen mit derselben Normalisierung wie die Canvas
    const formW = bounds.maxX - bounds.minX;
    const formH = bounds.maxY - bounds.minY;
    const minX = item.x + 0.4;
    const minY = item.y + 0.4;
    const maxX = item.x + formW + 0.4;
    const maxY = item.y + formH + 0.4;

    // Eine Formation (mit echten Pylonen) ausserhalb der Fläche ist ein "error":
    // die Strecke ist so nicht abfahrbar/regelkonform, anders als eine reine
    // Fahrtrichtungs-Markierung oben.
    if (minX < 0 || minY < 0 || maxX > ctx.fieldWidth || maxY > ctx.fieldLength) {
      issues.push({
        id: `bounds-${item.id}`,
        severity: "error",
        scope: "geometry",
        formationId: item.id,
        formationKey: item.key,
        message: "Formation liegt teilweise ausserhalb der Flaeche.",
      });
    }
  }

  // Pylonen verschiedener Formationen näher als 0.2 m gelten als "praktisch identische
  // Position" (Messungenauigkeit/Kollision beim Platzieren) — nur eine Warnung, da rein
  // visuell/planerisch auffällig, aber kein hartes Streckenmaß verletzt.
  for (let i = 0; i < ctx.worldCones.length; i++) {
    for (let j = i + 1; j < ctx.worldCones.length; j++) {
      const a = ctx.worldCones[i];
      const b = ctx.worldCones[j];
      if (a.formationId === b.formationId) continue;

      const d = distance(a.x, a.y, b.x, b.y);
      if (d < 0.2) {
        issues.push({
          id: `cone-overlap-${a.id}-${b.id}`,
          severity: "warning",
          scope: "geometry",
          formationId: a.formationId,
          formationKey: a.formationKey,
          message: "Pylonen verschiedener Formationen stehen nahezu aufeinander.",
          details: `Abstand ${d.toFixed(2)} m`,
        });
      }
    }
  }

  return issues;
}
