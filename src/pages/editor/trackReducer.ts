// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { PlacedFormation, PlacedArrow } from "../../types";

export type TrackState = { items: PlacedFormation[]; arrows: PlacedArrow[] };

export type TrackAction =
  | { type: "ADD_FORMATION"; formation: PlacedFormation }
  | { type: "DELETE_FORMATION"; id: string }
  | { type: "DELETE_FORMATIONS"; ids: string[] }
  | { type: "MOVE_FORMATION"; id: string; dx: number; dy: number }
  | { type: "MOVE_FORMATIONS"; ids: string[]; dx: number; dy: number }
  | { type: "UPDATE_FORMATION"; id: string; patch: Partial<PlacedFormation> }
  | { type: "CHECKPOINT" }
  | { type: "ADD_ARROW"; arrow: PlacedArrow }
  | { type: "DELETE_ARROW"; id: string }
  | { type: "MOVE_ARROW_CP"; id: string; dx: number; dy: number }
  | { type: "MOVE_ARROW_ENDPOINT"; id: string; handle: "start" | "end"; dx: number; dy: number }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "RESET"; state: TrackState };

export type HistState = { past: TrackState[]; present: TrackState; future: TrackState[] };

export const INITIAL_TRACK: TrackState = { items: [], arrows: [] };

export function trackReducer(s: HistState, action: TrackAction): HistState {
  const { past, present, future } = s;

  function live(p: TrackState): HistState { return { past, present: p, future }; }
  function commit(p: TrackState): HistState {
    return { past: [...past.slice(-29), present], present: p, future: [] };
  }

  switch (action.type) {
    case "ADD_FORMATION":
      return commit({ ...present, items: [...present.items, action.formation] });

    case "DELETE_FORMATION":
      return commit({ ...present, items: present.items.filter((it) => it.id !== action.id) });

    case "DELETE_FORMATIONS": {
      const delSet = new Set(action.ids);
      return commit({ ...present, items: present.items.filter((it) => !delSet.has(it.id)) });
    }

    case "MOVE_FORMATION":
      return live({
        ...present,
        items: present.items.map((it) =>
          it.id !== action.id ? it : {
            ...it,
            x: Math.max(0, Number((it.x + action.dx).toFixed(3))),
            y: Math.max(0, Number((it.y + action.dy).toFixed(3))),
          }
        ),
      });

    case "MOVE_FORMATIONS": {
      const moveSet = new Set(action.ids);
      return live({
        ...present,
        items: present.items.map((it) =>
          !moveSet.has(it.id) ? it : {
            ...it,
            x: Math.max(0, Number((it.x + action.dx).toFixed(3))),
            y: Math.max(0, Number((it.y + action.dy).toFixed(3))),
          }
        ),
      });
    }

    case "UPDATE_FORMATION":
      return commit({
        ...present,
        items: present.items.map((it) => it.id !== action.id ? it : { ...it, ...action.patch }),
      });

    case "CHECKPOINT":
      return { past: [...past.slice(-29), present], present, future: [] };

    case "ADD_ARROW":
      return commit({ ...present, arrows: [...present.arrows, action.arrow] });

    case "DELETE_ARROW":
      return commit({ ...present, arrows: present.arrows.filter((a) => a.id !== action.id) });

    case "MOVE_ARROW_CP":
      return live({
        ...present,
        arrows: present.arrows.map((a) =>
          a.id !== action.id ? a : { ...a, cpX: a.cpX + action.dx, cpY: a.cpY + action.dy }
        ),
      });

    case "MOVE_ARROW_ENDPOINT":
      return live({
        ...present,
        arrows: present.arrows.map((a) => {
          if (a.id !== action.id) return a;
          if (action.handle === "start") {
            const sx = a.startX + action.dx, sy = a.startY + action.dy;
            return { ...a, startX: sx, startY: sy, cpX: (sx + a.endX) / 2, cpY: (sy + a.endY) / 2 };
          } else {
            const ex = a.endX + action.dx, ey = a.endY + action.dy;
            return { ...a, endX: ex, endY: ey, cpX: (a.startX + ex) / 2, cpY: (a.startY + ey) / 2 };
          }
        }),
      });

    case "UNDO":
      if (!past.length) return s;
      return { past: past.slice(0, -1), present: past[past.length - 1], future: [present, ...future] };

    case "REDO":
      if (!future.length) return s;
      return { past: [...past, present], present: future[0], future: future.slice(1) };

    case "RESET":
      return { past: [], present: action.state, future: [] };
  }
}
