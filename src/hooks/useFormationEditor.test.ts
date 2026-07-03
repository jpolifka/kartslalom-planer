// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect } from "vitest";
import { reducer, EMPTY_SNAP } from "./useFormationEditor";
import type { HistState, EditorSnap, EditableCone } from "./useFormationEditor";
import type { PlacedArrow } from "../types";

const empty: HistState = { past: [], present: EMPTY_SNAP, future: [] };

function cone(id: string, x = 0, y = 0): EditableCone {
  return { id, x, y, kind: "standing", angleDeg: 0 };
}

function arrow(id: string): PlacedArrow {
  return { id, startX: 0, startY: 0, endX: 1, endY: 1, cpX: 0.5, cpY: 0.5 };
}

function snap(...cones: EditableCone[]): EditorSnap {
  return { cones, arrows: [] };
}

describe("useFormationEditor reducer", () => {
  describe("ADD_CONE", () => {
    it("adds cone to present and commits to past", () => {
      const s = reducer(empty, { type: "ADD_CONE", cone: cone("a") });
      expect(s.present.cones).toHaveLength(1);
      expect(s.present.cones[0].id).toBe("a");
      expect(s.past).toHaveLength(1);
      expect(s.future).toHaveLength(0);
    });
  });

  describe("DELETE_CONES", () => {
    it("removes specified cones and commits", () => {
      const s1 = reducer(empty, { type: "ADD_CONE", cone: cone("a") });
      const s2 = reducer(s1, { type: "ADD_CONE", cone: cone("b") });
      const s3 = reducer(s2, { type: "DELETE_CONES", ids: ["a"] });
      expect(s3.present.cones).toHaveLength(1);
      expect(s3.present.cones[0].id).toBe("b");
      expect(s3.past).toHaveLength(3);
    });

    it("ignores ids not in list", () => {
      const s1 = reducer(empty, { type: "ADD_CONE", cone: cone("a") });
      const s2 = reducer(s1, { type: "DELETE_CONES", ids: ["unknown"] });
      expect(s2.present.cones).toHaveLength(1);
    });
  });

  describe("MOVE_CONE", () => {
    it("updates position without pushing to past (live)", () => {
      const s1 = reducer(empty, { type: "ADD_CONE", cone: cone("a", 1, 1) });
      const s2 = reducer(s1, { type: "MOVE_CONE", id: "a", x: 3, y: 4 });
      expect(s2.present.cones[0].x).toBe(3);
      expect(s2.present.cones[0].y).toBe(4);
      expect(s2.past).toHaveLength(1); // no new entry vs ADD_CONE
    });
  });

  describe("UPDATE_CONE", () => {
    it("applies patch and commits", () => {
      const s1 = reducer(empty, { type: "ADD_CONE", cone: cone("a") });
      const s2 = reducer(s1, { type: "UPDATE_CONE", id: "a", patch: { angleDeg: 90, kind: "lying" } });
      expect(s2.present.cones[0].angleDeg).toBe(90);
      expect(s2.present.cones[0].kind).toBe("lying");
      expect(s2.past).toHaveLength(2);
    });
  });

  describe("ADD_ARROW", () => {
    it("adds arrow and commits", () => {
      const s = reducer(empty, { type: "ADD_ARROW", arrow: arrow("x") });
      expect(s.present.arrows).toHaveLength(1);
      expect(s.present.arrows[0].id).toBe("x");
      expect(s.past).toHaveLength(1);
    });
  });

  describe("DELETE_ARROW", () => {
    it("removes arrow and commits", () => {
      const s1 = reducer(empty, { type: "ADD_ARROW", arrow: arrow("x") });
      const s2 = reducer(s1, { type: "DELETE_ARROW", id: "x" });
      expect(s2.present.arrows).toHaveLength(0);
      expect(s2.past).toHaveLength(2);
    });
  });

  describe("MOVE_ARROW_CP", () => {
    it("shifts control point without committing (live)", () => {
      const s1 = reducer(empty, { type: "ADD_ARROW", arrow: arrow("x") });
      const s2 = reducer(s1, { type: "MOVE_ARROW_CP", id: "x", dx: 0.5, dy: -0.5 });
      expect(s2.present.arrows[0].cpX).toBeCloseTo(1.0);
      expect(s2.present.arrows[0].cpY).toBeCloseTo(0.0);
      expect(s2.past).toHaveLength(1);
    });
  });

  describe("MOVE_ARROW_ENDPOINT", () => {
    it("shifts start handle (live)", () => {
      const s1 = reducer(empty, { type: "ADD_ARROW", arrow: arrow("x") });
      const s2 = reducer(s1, { type: "MOVE_ARROW_ENDPOINT", id: "x", handle: "start", dx: 1, dy: 2 });
      expect(s2.present.arrows[0].startX).toBe(1);
      expect(s2.present.arrows[0].startY).toBe(2);
      expect(s2.past).toHaveLength(1);
    });

    it("shifts end handle (live)", () => {
      const s1 = reducer(empty, { type: "ADD_ARROW", arrow: arrow("x") });
      const s2 = reducer(s1, { type: "MOVE_ARROW_ENDPOINT", id: "x", handle: "end", dx: -1, dy: 0 });
      expect(s2.present.arrows[0].endX).toBe(0);
      expect(s2.past).toHaveLength(1);
    });
  });

  describe("CHECKPOINT", () => {
    it("pushes present to past without changing it", () => {
      const s1 = reducer(empty, { type: "ADD_CONE", cone: cone("a") });
      const s2 = reducer(s1, { type: "CHECKPOINT" });
      expect(s2.present.cones).toHaveLength(1);
      expect(s2.past).toHaveLength(2);
    });
  });

  describe("UNDO", () => {
    it("restores previous state and moves present to future", () => {
      const s1 = reducer(empty, { type: "ADD_CONE", cone: cone("a") });
      const s2 = reducer(s1, { type: "UNDO" });
      expect(s2.present.cones).toHaveLength(0);
      expect(s2.past).toHaveLength(0);
      expect(s2.future).toHaveLength(1);
    });

    it("is a no-op on empty past", () => {
      const s = reducer(empty, { type: "UNDO" });
      expect(s).toBe(empty);
    });
  });

  describe("REDO", () => {
    it("reapplies undone state", () => {
      const s1 = reducer(empty, { type: "ADD_CONE", cone: cone("a") });
      const s2 = reducer(s1, { type: "UNDO" });
      const s3 = reducer(s2, { type: "REDO" });
      expect(s3.present.cones).toHaveLength(1);
      expect(s3.future).toHaveLength(0);
      expect(s3.past).toHaveLength(1);
    });

    it("is a no-op on empty future", () => {
      const s = reducer(empty, { type: "REDO" });
      expect(s).toBe(empty);
    });

    it("new commit after undo clears future", () => {
      const s1 = reducer(empty, { type: "ADD_CONE", cone: cone("a") });
      const s2 = reducer(s1, { type: "UNDO" });
      const s3 = reducer(s2, { type: "ADD_CONE", cone: cone("b") });
      expect(s3.future).toHaveLength(0);
      expect(s3.present.cones[0].id).toBe("b");
    });
  });

  describe("RESET", () => {
    it("replaces present and clears history", () => {
      const s1 = reducer(empty, { type: "ADD_CONE", cone: cone("a") });
      const s2 = reducer(s1, { type: "ADD_CONE", cone: cone("b") });
      const newSnap = snap(cone("z", 5, 5));
      const s3 = reducer(s2, { type: "RESET", snap: newSnap });
      expect(s3.present.cones).toHaveLength(1);
      expect(s3.present.cones[0].id).toBe("z");
      expect(s3.past).toHaveLength(0);
      expect(s3.future).toHaveLength(0);
    });
  });

  describe("history cap", () => {
    it("keeps at most 30 entries in past", () => {
      let s = empty;
      for (let i = 0; i < 31; i++) {
        s = reducer(s, { type: "ADD_CONE", cone: cone(`c${i}`) });
      }
      expect(s.past).toHaveLength(30);
    });
  });
});
