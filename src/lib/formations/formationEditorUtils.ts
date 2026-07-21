// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { PYLON_SPACING, LANE_SPACING } from "./common";

export type SnapIndicator = { x1: number; y1: number; x2: number; y2: number; label: string };

// Fangradius beim Ziehen eines Pylons im Editor: Wird der Abstand zur naechsten Pylone auf
// 20 cm genau von einer der SNAP_CENTERS-Distanzen getroffen, rastet der Pylon exakt auf diese
// Regelmass-Distanz ein (Kante-zu-Kante-Pylonenabstand oder lichte Gassenbreite), statt an
// beliebigen Zwischenwerten liegen zu bleiben.
export const SNAP_THRESHOLD = 0.20;

// Liegen zwei Pylone naeher als 15 cm zusammen (deutlich unterhalb des kleinsten Regelabstands
// von 50 cm), gelten sie im Editor als "verschmolzen" bzw. versehentlich uebereinander gezogen,
// z. B. um sie zu einem einzigen Pylon zusammenzufuehren/zu loeschen.
export const MERGE_THRESHOLD = 0.15; // Cones innerhalb 15 cm → verschmelzen

// Distanzen, auf die ein gezogener Pylon von seiner naechsten Nachbar-Pylone aus einrasten kann:
// 0 m = direkt auf eine bestehende Pylone setzen, PYLON_SPACING = offizieller Pylonenabstand
// (0,50 m LB steht fuer "Luecke/lichte Breite"), LANE_SPACING = Torbreite einer Fahrgasse (1,65 m).
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

/**
 * Berechnet die eingerastete Position eines gezogenen Pylons. Es wird immer nur relativ zur
 * jeweils naechsten bestehenden Pylone gesnappt (nicht zu allen gleichzeitig), damit beim Bauen
 * einer Kette von Pylonen jeder neue Pylon exakt im Regelabstand zum letzten gesetzten liegt.
 */
export function applySnap(
  mx: number,
  my: number,
  movingId: string,
  cones: Array<{ id: string; x: number; y: number }>
): { x: number; y: number; indicator: SnapIndicator | null } {
  // Immer von der nächsten Pylone aus snappen
  let nearest: { x: number; y: number; d: number } | null = null;
  for (const c of cones) {
    if (c.id === movingId) continue;
    const d = dist(mx, my, c.x, c.y);
    if (d < 0.001) continue;
    if (!nearest || d < nearest.d) nearest = { x: c.x, y: c.y, d };
  }
  if (!nearest) return { x: mx, y: my, indicator: null };

  // Von allen Snap-Distanzen diejenige waehlen, die dem aktuellen Abstand am naechsten liegt
  // (und innerhalb SNAP_THRESHOLD). Die gezogene Position wird dann per Skalierung (ratio)
  // entlang der Linie Nachbar->Cursor auf exakt diese Soll-Distanz projiziert, die Richtung
  // zum Cursor bleibt dabei erhalten.
  let bestPos: { x: number; y: number } | null = null;
  let bestLabel = "";
  let bestDiff = SNAP_THRESHOLD;
  for (const [sd, label] of SNAP_CENTERS) {
    const diff = Math.abs(nearest.d - sd);
    if (diff < bestDiff) {
      bestDiff = diff;
      const ratio = sd / nearest.d;
      bestPos = { x: nearest.x + (mx - nearest.x) * ratio, y: nearest.y + (my - nearest.y) * ratio };
      bestLabel = label;
    }
  }
  if (!bestPos) return { x: mx, y: my, indicator: null };
  const indicator: SnapIndicator = { x1: nearest.x, y1: nearest.y, x2: bestPos.x, y2: bestPos.y, label: bestLabel };
  return { x: bestPos.x, y: bestPos.y, indicator };
}

/**
 * Verteilt Pylonen entlang einer Linie von (sx,sy) nach (ex,ey) im festen Regelabstand
 * PYLON_SPACING (inkl. Start- und Endpylon), z. B. beim Ziehen einer ganzen Pylonenreihe im
 * Editor statt einzelner Pylonen. Der Winkel wird so berechnet, dass 0° = Blickrichtung "nach
 * oben" entspricht und im Uhrzeigersinn waechst (Bildschirm-Y zeigt nach unten, daher -uy).
 */
export function computeLinePylons(sx: number, sy: number, ex: number, ey: number) {
  const dx = ex - sx, dy = ey - sy;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.001) return [{ x: sx, y: sy, angleDeg: 0 }];
  const ux = dx / d, uy = dy / d;
  const angleDeg = Math.round(((Math.atan2(ux, -uy) * 180 / Math.PI) % 360 + 360) % 360);
  // +1, weil sowohl Start- als auch Endpylon mitgezaehlt werden (count Pylonen ergeben
  // count-1 Zwischenraeume von je PYLON_SPACING).
  const count = Math.max(1, Math.floor(d / PYLON_SPACING) + 1);
  return Array.from({ length: count }, (_, i) => ({
    x: sx + ux * PYLON_SPACING * i,
    y: sy + uy * PYLON_SPACING * i,
    angleDeg,
  }));
}
