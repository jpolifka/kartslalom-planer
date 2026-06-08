// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { ConePoint } from "../types";

export function degToRad(value: number) {
  return (value * Math.PI) / 180;
}

export function rotatePoint(x: number, y: number, angleDeg: number, cx: number, cy: number) {
  const a = degToRad(angleDeg);
  const dx = x - cx;
  const dy = y - cy;

  return {
    x: cx + dx * Math.cos(a) - dy * Math.sin(a),
    y: cy + dx * Math.sin(a) + dy * Math.cos(a),
  };
}

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

export function normalizeCones(cones: ConePoint[]): ConePoint[] {
  const b = boundsFromCones(cones);
  return translateCones(cones, -b.minX, -b.minY);
}

export function rotateConesAroundOwnCenter(cones: ConePoint[], angleDeg: number): ConePoint[] {
  const b = boundsFromCones(cones);
  return cones.map((cone) => ({
    ...cone,
    ...rotatePoint(cone.x, cone.y, angleDeg, b.cx, b.cy),
    angleDeg: cone.angleDeg !== undefined ? cone.angleDeg + angleDeg : undefined,
  }));
}
