// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { PYLON_SPACING, LANE_SPACING } from "./common";

export type SnapIndicator = { x1: number; y1: number; x2: number; y2: number; label: string };

export const SNAP_THRESHOLD = 0.20;

export const MERGE_THRESHOLD = 0.15; // Cones innerhalb 15 cm → verschmelzen

const SNAP_CENTERS: [number, string][] = [
  [0,            "0 m (aufeinander)"],
  [PYLON_SPACING, "0,50 m LB"],
  [LANE_SPACING,  "1,65 m LB"],
];

export function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

/** Zeigt die Entfernung zur nächsten Pylone ohne zu snappen — rein informativ. */
export function getNearestIndicator(
  mx: number,
  my: number,
  movingId: string,
  cones: Array<{ id: string; x: number; y: number }>
): SnapIndicator | null {
  let nearest: { d: number; x: number; y: number } | null = null;
  for (const c of cones) {
    if (c.id === movingId) continue;
    const d = dist(mx, my, c.x, c.y);
    if (d < 0.001) continue;
    if (!nearest || d < nearest.d) nearest = { d, x: c.x, y: c.y };
  }
  if (!nearest) return null;
  return { x1: nearest.x, y1: nearest.y, x2: mx, y2: my, label: `${nearest.d.toFixed(2)} m` };
}

export function applySnap(
  mx: number,
  my: number,
  movingId: string,
  cones: Array<{ id: string; x: number; y: number }>
): { x: number; y: number; indicator: SnapIndicator | null } {
  let bestPos: { x: number; y: number } | null = null;
  let bestIndicator: SnapIndicator | null = null;
  let bestDiff = SNAP_THRESHOLD;
  for (const c of cones) {
    if (c.id === movingId) continue;
    const d = dist(mx, my, c.x, c.y);
    if (d < 0.001) continue;
    for (const [sd, label] of SNAP_CENTERS) {
      const diff = Math.abs(d - sd);
      if (diff < bestDiff) {
        bestDiff = diff;
        const ratio = sd / d;
        bestPos = { x: c.x + (mx - c.x) * ratio, y: c.y + (my - c.y) * ratio };
        bestIndicator = { x1: c.x, y1: c.y, x2: bestPos.x, y2: bestPos.y, label };
      }
    }
  }
  return { x: bestPos?.x ?? mx, y: bestPos?.y ?? my, indicator: bestIndicator };
}

export function computeLinePylons(sx: number, sy: number, ex: number, ey: number) {
  const dx = ex - sx, dy = ey - sy;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.001) return [{ x: sx, y: sy, angleDeg: 0 }];
  const ux = dx / d, uy = dy / d;
  const angleDeg = Math.round(((Math.atan2(ux, -uy) * 180 / Math.PI) % 360 + 360) % 360);
  const count = Math.max(1, Math.floor(d / PYLON_SPACING) + 1);
  return Array.from({ length: count }, (_, i) => ({
    x: sx + ux * PYLON_SPACING * i,
    y: sy + uy * PYLON_SPACING * i,
    angleDeg,
  }));
}
