// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { ConePoint, FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { TASK_LANE_WIDTH, lying, standing } from "./common";

function degToRad(value: number) {
  return (value * Math.PI) / 180;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Verteilt Pylonen gleichmaessig auf einem Kreisbogen (Radius `radius` um den Mittelpunkt),
 * mit ca. `targetSpacing` Meter Abstand zwischen benachbarten Pylonen entlang des Umfangs.
 * Da der tatsaechliche Pylonenabstand nur ganzzahlig auf 360° aufgehen kann, wird die Anzahl
 * gerundet (mindestens 12, damit auch kleine Kreise noch rund wirken) — der reale Abstand
 * weicht dadurch minimal von targetSpacing ab. `skipRangesDeg` blendet Winkelbereiche aus
 * (z. B. fuer Ein-/Ausfahrten, an denen stattdessen eigene Torpylonen gesetzt werden).
 */
function buildRing(
  centerX: number,
  centerY: number,
  radius: number,
  targetSpacing: number,
  skipRangesDeg: Array<[number, number]> = []
): ConePoint[] {
  const circumference = 2 * Math.PI * radius;
  const count = Math.max(12, Math.round(circumference / targetSpacing));
  const stepDeg = 360 / count;
  const points: ConePoint[] = [];

  for (let i = 0; i < count; i++) {
    const angleDeg = i * stepDeg;

    const shouldSkip = skipRangesDeg.some(([start, end]) => {
      if (start <= end) return angleDeg >= start && angleDeg <= end;
      return angleDeg >= start || angleDeg <= end;
    });

    if (shouldSkip) continue;

    const angleRad = degToRad(angleDeg);
    const x = centerX + radius * Math.cos(angleRad);
    const y = centerY + radius * Math.sin(angleRad);

    points.push(standing(Number(x.toFixed(3)), Number(y.toFixed(3))));
  }

  return points;
}

// "Kreisel" (Kreisverkehr-Uebung): zwei konzentrische Pylonenringe (innen/außen), zwischen
// denen das Kart im Kreis faehrt — vergleichbar mit einem echten Kreisverkehr. Die Fahrspur
// zwischen den Ringen entspricht der Standard-Gassenbreite (TASK_LANE_WIDTH). Eine eigene
// Einfahrt (Torbreite 3 m) und Ausfahrt (Torbreite = Fahrspurbreite) durchbrechen die Ringe an
// definierten Stellen; die IIFE unten baut Ringe, Tore und Richtungspfeile in einem Zug.
export const circle: FormationDefinition = {
  key: "circle",
  label: "Kreisel",
  description:
    "Innendurchmesser 10 m, Pylonenabstand 1,0 m, Einfahrt A = 3 m, Ausfahrt B = Fahrspurbreite.",
  defaultDirection: "none",
  cones: normalizeCones(
    (() => {
      const innerDiameter = 10.0;
      const innerRadius = innerDiameter / 2; // 5.0
      const laneWidth = TASK_LANE_WIDTH;     // 1.65
      const outerRadius = innerRadius + laneWidth;
      const targetSpacing = 1.0;

      // etwas Platz links fuer Pfeile/Beschriftung
      const centerX = outerRadius + 4.0;
      const centerY = outerRadius + 2.0;

      // Oeffnungen links:
      // aussen nur kleine Luecken, weil die Torpylonen zusaetzlich gesetzt werden
      const outerGap: Array<[number, number]> = [
        [164, 176], // Einfahrt A oben links
        [184, 196], // Ausfahrt B unten links
      ];

      // innen groessere Oeffnung fuer die Fahrspur / Ausfahrt
      const innerGap: Array<[number, number]> = [[165, 195]];

      const cones: ConePoint[] = [
        ...buildRing(centerX, centerY, outerRadius, targetSpacing, outerGap),
        ...buildRing(centerX, centerY, innerRadius, targetSpacing, innerGap),
      ];

      // Aussenkreis: zusaetzliche Torpylonen fuer Einfahrt A = 3 m
      const outerGateX = centerX - outerRadius;
      const entryTopY = centerY + 1.5;
      const entryBottomY = centerY - 1.5;

      cones.push(
        standing(Number(outerGateX.toFixed(3)), Number(entryTopY.toFixed(3))),
        standing(Number(outerGateX.toFixed(3)), Number(entryBottomY.toFixed(3)))
      );

      // Innenkreis: zusaetzliche Torpylonen fuer Ausfahrt B = Fahrspurbreite
      const innerGateX = centerX - innerRadius;
      const exitTopY = centerY + laneWidth / 2;
      const exitBottomY = centerY - laneWidth / 2;

      cones.push(
        standing(Number(innerGateX.toFixed(3)), Number(exitTopY.toFixed(3))),
        standing(Number(innerGateX.toFixed(3)), Number(exitBottomY.toFixed(3)))
      );

      // Richtungsdreiecke links wie in der Skizze
      const arrowX = outerGateX - 0.9;
      cones.push(
        lying(Number(arrowX.toFixed(3)), Number((centerY + 2.4).toFixed(3)), "direction", 90),
        lying(Number(arrowX.toFixed(3)), Number(centerY.toFixed(3)), "direction", 90),
        lying(Number(arrowX.toFixed(3)), Number((centerY - 2.4).toFixed(3)), "direction", 90)
      );

      // Dubletten/Nachbarn entschaerfen
      const deduped: ConePoint[] = [];
      for (const cone of cones) {
        const exists = deduped.some((existing) => {
          if (existing.kind !== cone.kind) return false;
          return distance(existing, cone) < 0.3;
        });
        if (!exists) deduped.push(cone);
      }

      return deduped;
    })()
  ),
};
