import type { ConePoint } from "../../types";

export const PYLON_HEIGHT = 0.5;
export const PYLON_SPACING = 0.5;
export const SLICK_TRACK_WIDTH = 1.25;
export const TASK_LANE_WIDTH = SLICK_TRACK_WIDTH + 0.4; // 1.65 m
export const HALF_LANE_WIDTH = TASK_LANE_WIDTH / 2;
export const ONE_AND_HALF_LANE_WIDTH = TASK_LANE_WIDTH * 1.5;

export function standing(
  x: number,
  y: number,
  role: ConePoint["role"] = "normal"
): ConePoint {
  return { x, y, kind: "standing", role };
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
  return value * TASK_LANE_WIDTH;
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

  standing(role: ConePoint["role"] = "normal") {
    this.cones.push(standing(this.x, this.y, role));
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
