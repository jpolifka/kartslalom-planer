// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { ConePoint } from "../../types";

export const PYLON_HEIGHT = 0.5;
// Pylonenfuß: 30 x 30 cm. Alle Streckenmaße (Pylonenabstand, lichte Torbreite) werden laut
// DMSB-Reglement Kante-zu-Kante bzw. an der Innenkante des Fußes gemessen, nicht Mittelpunkt-zu-Mittelpunkt.
// Da die Cone-Koordinaten den Mittelpunkt des Pylonen darstellen, muss der Pylon-Durchmesser
// auf den offiziellen Kantenabstand aufaddiert werden, um den Mittelpunktabstand zu erhalten.
export const PYLON_FOOT_SIZE = 0.30;
export const PYLON_GAP = 0.5; // offizieller Pylonenabstand, Kante zu Kante
export const PYLON_SPACING = PYLON_GAP + PYLON_FOOT_SIZE; // Mittelpunktabstand = 0,80 m
export const SLICK_TRACK_WIDTH = 1.25;
export const TASK_LANE_WIDTH = SLICK_TRACK_WIDTH + 0.4; // 1,65 m lichte Breite (Innenkante zu Innenkante)
export const LANE_SPACING = TASK_LANE_WIDTH + PYLON_FOOT_SIZE; // Mittelpunktabstand der Torpylonen = 1,95 m
export const HALF_LANE_WIDTH = LANE_SPACING / 2;
export const ONE_AND_HALF_LANE_WIDTH = LANE_SPACING * 1.5;

export function standing(
  x: number,
  y: number,
  role: ConePoint["role"] = "normal",
  angleDeg = 0
): ConePoint {
  return { x, y, kind: "standing", role, angleDeg };
}

export function lying(
  x: number,
  y: number,
  role: ConePoint["role"] = "direction",
  angleDeg = 0
): ConePoint {
  return { x, y, kind: "lying", role, angleDeg };
}

export function sensor(x: number, y: number): ConePoint {
  return { x, y, kind: "sensor" };
}

export function meter(value: number) {
  return value;
}

export function pylon(value = 1) {
  return value * PYLON_SPACING;
}

export function pylon_height(value = 1) {
  return value * PYLON_HEIGHT;
}

export function lane(value = 1) {
  return value * LANE_SPACING;
}

export function half_lane(value = 1) {
  return value * HALF_LANE_WIDTH;
}

export function lane_and_half(value = 1) {
  return value * ONE_AND_HALF_LANE_WIDTH;
}

export class FormationBuilder {
  private x = 0;
  private y = 0;
  private cones: ConePoint[] = [];

  at(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }

  move_meter(dx = 0, dy = 0) {
    this.x += meter(dx);
    this.y += meter(dy);
    return this;
  }

  move_pylon(dx = 0, dy = 0) {
    this.x += pylon(dx);
    this.y += pylon(dy);
    return this;
  }

  move_lane(dx = 0, dy = 0) {
    this.x += lane(dx);
    this.y += lane(dy);
    return this;
  }

  move_half_lane(dx = 0, dy = 0) {
    this.x += half_lane(dx);
    this.y += half_lane(dy);
    return this;
  }

  move_pylon_height(dx = 0, dy = 0) {
    this.x += pylon_height(dx);
    this.y += pylon_height(dy);
    return this;
  }

  standing(role: ConePoint["role"] = "normal", angleDeg = 0) {
    this.cones.push(standing(this.x, this.y, role, angleDeg));
    return this;
  }

  lying(angleDeg = 0, role: ConePoint["role"] = "direction") {
    this.cones.push(lying(this.x, this.y, role, angleDeg));
    return this;
  }

  sensor() {
    this.cones.push(sensor(this.x, this.y));
    return this;
  }

  points() {
    return this.cones;
  }
}

export function builder() {
  return new FormationBuilder();
}
