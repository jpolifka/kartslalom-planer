// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect } from "vitest";
import { applySnap, computeLinePylons, SNAP_THRESHOLD } from "./formationEditorUtils";
import { PYLON_SPACING, LANE_SPACING } from "./common";

// Deckt die zwei Kern-Verhalten des Formation-Editors ab: (1) applySnap rastet gezogene
// Pylonen auf die regelkonformen Distanzen PYLON_SPACING (0,50 m LB) bzw. LANE_SPACING
// (1,65 m LB) zur naechsten Nachbar-Pylone ein, sofern der Abstand innerhalb SNAP_THRESHOLD
// liegt; (2) computeLinePylons erzeugt beim Ziehen einer ganzen Reihe gleichmaessig im
// Regelabstand verteilte Pylonen samt Ausrichtungswinkel.

// ─── applySnap ───────────────────────────────────────────────────────────────

describe("applySnap", () => {
  it("returns original position when no cones present", () => {
    const result = applySnap(2, 3, "", []);
    expect(result.x).toBe(2);
    expect(result.y).toBe(3);
    expect(result.indicator).toBeNull();
  });

  it("returns original position when no cone is within snap threshold", () => {
    const cones = [{ id: "a", x: 0, y: 0 }];
    // Place cursor far away so distance is way outside threshold for both snap centers
    const result = applySnap(5, 0, "", cones);
    expect(result.x).toBe(5);
    expect(result.y).toBe(0);
    expect(result.indicator).toBeNull();
  });

  it("snaps to PYLON_SPACING distance from nearest cone", () => {
    const cones = [{ id: "a", x: 0, y: 0 }];
    // Place cursor almost exactly at PYLON_SPACING (0.80 m) along x-axis
    const target = PYLON_SPACING + 0.05; // within 20 cm threshold
    const result = applySnap(target, 0, "", cones);
    expect(result.x).toBeCloseTo(PYLON_SPACING, 5);
    expect(result.y).toBeCloseTo(0, 5);
    expect(result.indicator).not.toBeNull();
    expect(result.indicator!.label).toBe("0,50 m LB");
  });

  it("snaps to LANE_SPACING distance from nearest cone", () => {
    const cones = [{ id: "a", x: 0, y: 0 }];
    // Place cursor almost exactly at LANE_SPACING (1.95 m) along y-axis
    const target = LANE_SPACING - 0.05; // within threshold
    const result = applySnap(0, target, "", cones);
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.y).toBeCloseTo(LANE_SPACING, 5);
    expect(result.indicator!.label).toBe("1,65 m LB");
  });

  it("ignores cone with matching movingId (self-snap prevention)", () => {
    const cones = [{ id: "self", x: 0, y: 0 }];
    // Without self-exclusion this would snap; with exclusion it should not
    const result = applySnap(PYLON_SPACING + 0.05, 0, "self", cones);
    expect(result.x).toBeCloseTo(PYLON_SPACING + 0.05);
    expect(result.indicator).toBeNull();
  });

  it("ignores coincident cone (distance < 0.001)", () => {
    const cones = [{ id: "a", x: 2, y: 3 }];
    // Cursor is at exact same position as cone → distance 0 → skip
    const result = applySnap(2, 3, "", cones);
    expect(result.x).toBe(2);
    expect(result.y).toBe(3);
    expect(result.indicator).toBeNull();
  });

  it("prefers the closer snap target when two cones compete", () => {
    const cones = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 10, y: 0 },
    ];
    // Place cursor near PYLON_SPACING from cone "a"
    const result = applySnap(PYLON_SPACING + 0.05, 0, "", cones);
    expect(result.indicator!.x1).toBe(0); // snapped from cone "a"
  });

  it("returns no snap when cursor is clearly beyond threshold", () => {
    const cones = [{ id: "a", x: 0, y: 0 }];
    // diff = SNAP_THRESHOLD + 0.05 → outside pull radius for both snap centers
    const result = applySnap(PYLON_SPACING + SNAP_THRESHOLD + 0.05, 0, "", cones);
    expect(result.indicator).toBeNull();
  });
});

// ─── computeLinePylons ───────────────────────────────────────────────────────

describe("computeLinePylons", () => {
  it("returns single pylon at start when length is zero", () => {
    const pylons = computeLinePylons(1, 2, 1, 2);
    expect(pylons).toHaveLength(1);
    expect(pylons[0]).toEqual({ x: 1, y: 2, angleDeg: 0 });
  });

  it("returns 2 pylons for a line of exactly PYLON_SPACING length", () => {
    const pylons = computeLinePylons(0, 0, PYLON_SPACING, 0);
    expect(pylons).toHaveLength(2);
    expect(pylons[0].x).toBeCloseTo(0);
    expect(pylons[1].x).toBeCloseTo(PYLON_SPACING);
  });

  it("returns 3 pylons for a line of 2×PYLON_SPACING length", () => {
    const pylons = computeLinePylons(0, 0, PYLON_SPACING * 2, 0);
    expect(pylons).toHaveLength(3);
  });

  it("returns at least 1 pylon for a line shorter than PYLON_SPACING", () => {
    const pylons = computeLinePylons(0, 0, 0.3, 0);
    expect(pylons).toHaveLength(1);
  });

  it("computes correct angle for a horizontal line (rightward = 90°)", () => {
    const pylons = computeLinePylons(0, 0, 1, 0);
    expect(pylons[0].angleDeg).toBe(90);
  });

  it("computes correct angle for a vertical line (downward = 180°)", () => {
    const pylons = computeLinePylons(0, 0, 0, 1);
    expect(pylons[0].angleDeg).toBe(180);
  });

  it("all pylons share the same angle", () => {
    const pylons = computeLinePylons(0, 0, PYLON_SPACING * 3, PYLON_SPACING * 3);
    const firstAngle = pylons[0].angleDeg;
    expect(pylons.every((p) => p.angleDeg === firstAngle)).toBe(true);
  });

  it("pylons are spaced exactly PYLON_SPACING apart", () => {
    const pylons = computeLinePylons(0, 0, PYLON_SPACING * 2, 0);
    for (let i = 1; i < pylons.length; i++) {
      const d = Math.sqrt((pylons[i].x - pylons[i - 1].x) ** 2 + (pylons[i].y - pylons[i - 1].y) ** 2);
      expect(d).toBeCloseTo(PYLON_SPACING, 5);
    }
  });
});
