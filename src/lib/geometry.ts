// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { ConePoint } from "../types";

// Cone-Koordinaten (ConePoint.x/y) sind Meter in einem lokalen, pro Formation
// eigenen Koordinatensystem — x nach rechts, y nach unten (wie SVG/Canvas,
// nicht wie ein mathematisches Koordinatensystem mit y nach oben). Die
// Rotationsformel unten ist deshalb trotz der "mathematisch" aussehenden
// cos/sin-Form bei positivem angleDeg eine Drehung im Uhrzeigersinn (y-Achse
// zeigt nach unten), konsistent mit der "im Uhrzeigersinn"-Konvention von
// PlacedFormation.rotationDeg / AreaSelection.rotationDeg.
export function degToRad(value: number) {
  return (value * Math.PI) / 180;
}

// Dreht einen Punkt um ein beliebiges Zentrum (cx, cy) — Standard-2D-
// Rotationsmatrix um den angegebenen Pivot statt um den Ursprung.
export function rotatePoint(x: number, y: number, angleDeg: number, cx: number, cy: number) {
  const a = degToRad(angleDeg);
  const dx = x - cx;
  const dy = y - cy;

  return {
    x: cx + dx * Math.cos(a) - dy * Math.sin(a),
    y: cy + dx * Math.sin(a) + dy * Math.cos(a),
  };
}

// Achsenparallele Bounding-Box einer Cone-Menge im jeweils aktuellen lokalen
// Koordinatensystem (vor oder nach Normalisierung/Rotation, je nach Aufrufer).
export function boundsFromCones(cones: ConePoint[]) {
  const xs = cones.map((c) => c.x);
  const ys = cones.map((c) => c.y);

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

export function translateCones(cones: ConePoint[], dx: number, dy: number): ConePoint[] {
  return cones.map((cone) => ({ ...cone, x: cone.x + dx, y: cone.y + dy }));
}

// Verschiebt eine Formation so, dass die obere linke Ecke ihrer Bounding-Box
// bei (0,0) liegt. Formationsdefinitionen (formations/*.ts) werden oft mit
// bequemen, teils negativen Koordinaten relativ zu einem gedachten Ankerpunkt
// (z. B. Torlinienmitte) autorenfreundlich notiert; normalizeCones() sorgt
// dafür, dass alle Formationen unabhängig davon eine einheitliche (0,0)-
// Startecke haben, bevor sie in der Registry (formationRegistry.ts) landen —
// exportSVG.ts/TrackCanvas.tsx können sich dadurch beim Platzieren immer auf
// dieselbe Ankerkonvention verlassen.
export function normalizeCones(cones: ConePoint[]): ConePoint[] {
  const b = boundsFromCones(cones);
  return translateCones(cones, -b.minX, -b.minY);
}

// Dreht eine platzierte Formation um ihren EIGENEN Bounding-Box-Mittelpunkt
// (nicht um den Ursprung oder einen globalen Feldpunkt) — das ist die
// erwartete Bedienung im Editor: eine Formation soll sich beim Rotieren "auf
// der Stelle" drehen. Cone.angleDeg (z. B. Ausrichtung liegender Pylonen)
// wird zusätzlich um denselben Winkel mitgedreht, damit die einzelnen Kegel
// nach der Formation-Rotation weiterhin in die richtige Richtung zeigen.
export function rotateConesAroundOwnCenter(cones: ConePoint[], angleDeg: number): ConePoint[] {
  const b = boundsFromCones(cones);
  return cones.map((cone) => ({
    ...cone,
    ...rotatePoint(cone.x, cone.y, angleDeg, b.cx, b.cy),
    angleDeg: cone.angleDeg !== undefined ? cone.angleDeg + angleDeg : undefined,
  }));
}
