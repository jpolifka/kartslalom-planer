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

      // etwas Platz links für Pfeile/Beschriftung
      const centerX = outerRadius + 4.0;
      const centerY = outerRadius + 2.0;

      // Öffnungen links:
      // außen nur kleine Lücken, weil die Torpylonen zusätzlich gesetzt werden
      const outerGap: Array<[number, number]> = [
        [164, 176], // Einfahrt A oben links
        [184, 196], // Ausfahrt B unten links
      ];

      // innen größere Öffnung für die Fahrspur / Ausfahrt
      const innerGap: Array<[number, number]> = [[165, 195]];

      const cones: ConePoint[] = [
        ...buildRing(centerX, centerY, outerRadius, targetSpacing, outerGap),
        ...buildRing(centerX, centerY, innerRadius, targetSpacing, innerGap),
      ];

      // Außenkreis: zusätzliche Torpylonen für Einfahrt A = 3 m
      const outerGateX = centerX - outerRadius;
      const entryTopY = centerY + 1.5;
      const entryBottomY = centerY - 1.5;

      cones.push(
        standing(Number(outerGateX.toFixed(3)), Number(entryTopY.toFixed(3))),
        standing(Number(outerGateX.toFixed(3)), Number(entryBottomY.toFixed(3)))
      );

      // Innenkreis: zusätzliche Torpylonen für Ausfahrt B = Fahrspurbreite
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

      // Dubletten/Nachbarn entschärfen
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
