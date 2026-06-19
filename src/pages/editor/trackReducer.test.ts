// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect } from "vitest";
import { trackReducer, INITIAL_TRACK } from "./trackReducer";
import type { HistState, TrackAction } from "./trackReducer";
import type { PlacedFormation } from "../../types";

const empty: HistState = { past: [], present: INITIAL_TRACK, future: [] };

function formation(id: string, x = 0, y = 0): PlacedFormation {
  return { id, key: "singlePylon", x, y, rotationDeg: 0, direction: "none" };
}

function dispatch(state: HistState, action: TrackAction): HistState {
  return trackReducer(state, action);
}

describe("trackReducer", () => {
  it("add item", () => {
    const s = dispatch(empty, { type: "ADD_FORMATION", formation: formation("a") });
    expect(s.present.items).toHaveLength(1);
    expect(s.present.items[0].id).toBe("a");
    expect(s.past).toHaveLength(1);
    expect(s.future).toHaveLength(0);
  });

  it("move item", () => {
    const s1 = dispatch(empty, { type: "ADD_FORMATION", formation: formation("a", 5, 5) });
    const s2 = dispatch(s1, { type: "MOVE_FORMATION", id: "a", dx: 2, dy: 3 });
    expect(s2.present.items[0].x).toBe(7);
    expect(s2.present.items[0].y).toBe(8);
    // live() does not push to past
    expect(s2.past).toHaveLength(1);
  });

  it("rotate item", () => {
    const s1 = dispatch(empty, { type: "ADD_FORMATION", formation: formation("a") });
    const s2 = dispatch(s1, { type: "UPDATE_FORMATION", id: "a", patch: { rotationDeg: 90 } });
    expect(s2.present.items[0].rotationDeg).toBe(90);
    expect(s2.past).toHaveLength(2);
  });

  it("delete item", () => {
    const s1 = dispatch(empty, { type: "ADD_FORMATION", formation: formation("a") });
    const s2 = dispatch(s1, { type: "DELETE_FORMATION", id: "a" });
    expect(s2.present.items).toHaveLength(0);
    expect(s2.past).toHaveLength(2);
  });

  it("undo", () => {
    const s1 = dispatch(empty, { type: "ADD_FORMATION", formation: formation("a") });
    const s2 = dispatch(s1, { type: "UNDO" });
    expect(s2.present.items).toHaveLength(0);
    expect(s2.future).toHaveLength(1);
    expect(s2.past).toHaveLength(0);
  });

  it("redo", () => {
    const s1 = dispatch(empty, { type: "ADD_FORMATION", formation: formation("a") });
    const s2 = dispatch(s1, { type: "UNDO" });
    const s3 = dispatch(s2, { type: "REDO" });
    expect(s3.present.items).toHaveLength(1);
    expect(s3.future).toHaveLength(0);
    expect(s3.past).toHaveLength(1);
  });
});
