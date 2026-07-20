// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// Reducer-basierter Undo/Redo-Zustand für den Formation-Editor (Cones + Pfeile).
// Strategie: volle Snapshots (kein Diffing/Patches) — bei den überschaubaren
// Datenmengen einer Formation (typischerweise < 100 Objekte) ist das einfach,
// robust und schnell genug; past/future sind auf 30 Einträge gedeckelt, damit
// der Speicher bei langen Sessions nicht unbegrenzt wächst.
//
// Wichtige Unterscheidung "live" vs. "commit":
// Aktionen, die während eines Drags kontinuierlich feuern (MOVE_CONE, BATCH_MOVE beim
// Verschieben mehrerer Cones, MOVE_ARROW_CP, MOVE_ARROW_ENDPOINT) schreiben nur den
// aktuellen Zustand (live) und legen KEINEN Undo-Eintrag an — sonst würde jeder einzelne
// Mausmove-Frame die History fluten. Erst ein expliziter CHECKPOINT (vom Canvas beim
// Drag-Ende gefeuert) schiebt den bis dahin erreichten Stand als einen einzigen
// Undo-Schritt in "past". Alle übrigen, diskreten Aktionen (Hinzufügen/Löschen/Rotieren/
// Patch) committen dagegen sofort.

import { useReducer } from "react";
import type { ConePoint, PlacedArrow } from "../types";

export type EditableCone = ConePoint & { id: string };

export type EditorSnap = { cones: EditableCone[]; arrows: PlacedArrow[] };

export type EditorAction =
  | { type: "ADD_CONE"; cone: EditableCone }
  | { type: "ADD_CONES"; cones: EditableCone[] }
  | { type: "DELETE_CONES"; ids: string[] }
  | { type: "MOVE_CONE"; id: string; x: number; y: number }
  | { type: "BATCH_MOVE"; moves: Array<{ id: string; x: number; y: number }> }
  | { type: "ROTATE_SELECTION"; ids: string[]; angleDeg: number }
  | { type: "UPDATE_CONE"; id: string; patch: Partial<EditableCone> }
  | { type: "ADD_ARROW"; arrow: PlacedArrow }
  | { type: "DELETE_ARROW"; id: string }
  | { type: "MOVE_ARROW_CP"; id: string; dx: number; dy: number }
  | { type: "MOVE_ARROW_ENDPOINT"; id: string; handle: "start" | "end"; dx: number; dy: number }
  | { type: "CHECKPOINT" }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "RESET"; snap: EditorSnap };

export type HistState = { past: EditorSnap[]; present: EditorSnap; future: EditorSnap[] };

export function reducer(s: HistState, action: EditorAction): HistState {
  const { past, present, future } = s;

  const live = (p: EditorSnap): HistState => ({ past, present: p, future });
  const commit = (p: EditorSnap): HistState => ({
    past: [...past.slice(-29), present],
    present: p,
    future: [],
  });

  switch (action.type) {
    case "ADD_CONE":
      return commit({ ...present, cones: [...present.cones, action.cone] });
    case "ADD_CONES":
      return commit({ ...present, cones: [...present.cones, ...action.cones] });
    case "DELETE_CONES":
      return commit({ ...present, cones: present.cones.filter((c) => !action.ids.includes(c.id)) });
    case "MOVE_CONE":
      return live({
        ...present,
        cones: present.cones.map((c) => c.id === action.id ? { ...c, x: action.x, y: action.y } : c),
      });
    case "BATCH_MOVE": {
      const moveMap = new Map(action.moves.map((m) => [m.id, m]));
      return live({
        ...present,
        cones: present.cones.map((c) => { const m = moveMap.get(c.id); return m ? { ...c, x: m.x, y: m.y } : c; }),
      });
    }
    case "ROTATE_SELECTION": {
      const sel = present.cones.filter((c) => action.ids.includes(c.id));
      if (sel.length === 0) return s;
      const cx = sel.reduce((s, c) => s + c.x, 0) / sel.length;
      const cy = sel.reduce((s, c) => s + c.y, 0) / sel.length;
      const rad = (action.angleDeg * Math.PI) / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      return commit({
        ...present,
        cones: present.cones.map((c) => {
          if (!action.ids.includes(c.id)) return c;
          const dx = c.x - cx, dy = c.y - cy;
          return { ...c, x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
        }),
      });
    }
    case "UPDATE_CONE":
      return commit({
        ...present,
        cones: present.cones.map((c) => c.id === action.id ? { ...c, ...action.patch } : c),
      });
    case "ADD_ARROW":
      return commit({ ...present, arrows: [...present.arrows, action.arrow] });
    case "DELETE_ARROW":
      return commit({ ...present, arrows: present.arrows.filter((a) => a.id !== action.id) });
    case "MOVE_ARROW_CP":
      return live({
        ...present,
        arrows: present.arrows.map((a) =>
          a.id === action.id ? { ...a, cpX: a.cpX + action.dx, cpY: a.cpY + action.dy } : a
        ),
      });
    case "MOVE_ARROW_ENDPOINT":
      return live({
        ...present,
        arrows: present.arrows.map((a) => {
          if (a.id !== action.id) return a;
          return action.handle === "start"
            ? { ...a, startX: a.startX + action.dx, startY: a.startY + action.dy }
            : { ...a, endX: a.endX + action.dx, endY: a.endY + action.dy };
        }),
      });
    case "CHECKPOINT":
      return commit(present);
    case "UNDO":
      if (!past.length) return s;
      return { past: past.slice(0, -1), present: past[past.length - 1], future: [present, ...future.slice(0, 29)] };
    case "REDO":
      if (!future.length) return s;
      return { past: [...past.slice(-29), present], present: future[0], future: future.slice(1) };
    case "RESET":
      return { past: [], present: action.snap, future: [] };
    default:
      return s;
  }
}

export const EMPTY_SNAP: EditorSnap = { cones: [], arrows: [] };

export function useFormationEditor(initial?: EditorSnap) {
  const [hist, dispatch] = useReducer(reducer, undefined, () => ({
    past: [],
    present: initial ?? EMPTY_SNAP,
    future: [],
  }));

  return {
    cones: hist.present.cones,
    arrows: hist.present.arrows,
    snap: hist.present,
    dispatch,
    canUndo: hist.past.length > 0,
    canRedo: hist.future.length > 0,
  };
}
