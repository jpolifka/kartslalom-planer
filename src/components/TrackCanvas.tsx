// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { PlacedArrow, PlacedFormation } from "../types";
import type { ValidationIssue } from "../lib/validation/types";
import { boundsFromCones, rotateConesAroundOwnCenter } from "../lib/geometry";
import { getFormation } from "../lib/formationRegistry";
import MapBackground from "./MapBackground";
import type { AreaSelection } from "../lib/areaSelection";

export type MapConfig = {
  selection: AreaSelection;
  satellite: boolean;
  opacity: number;
};

type TrackCanvasProps = {
  fieldWidth: number;
  fieldLength: number;
  items: PlacedFormation[];
  selectedIds: Set<string>;
  onSelect: (id: string, addToSelection: boolean) => void;
  onMove: (id: string, dx: number, dy: number) => void;
  onMoveMultiple: (ids: string[], dx: number, dy: number) => void;
  onFormationDragStart?: () => void;
  onDeselectAll?: () => void;
  issues: ValidationIssue[];
  drawingArrowMode: boolean;
  onArrowDrawn: (a: Omit<PlacedArrow, "id">) => void;
  arrows: PlacedArrow[];
  selectedArrowId: string | null;
  onSelectArrow: (id: string | null) => void;
  onArrowCpMove: (id: string, dx: number, dy: number) => void;
  onArrowEndpointMove: (id: string, handle: "start" | "end", dx: number, dy: number) => void;
  mapConfig?: MapConfig | null;
};

import type { ConePoint } from "../types";

type PreparedItem = {
  item: PlacedFormation;
  formation: ReturnType<typeof getFormation>;
  normalized: ConePoint[];
  width: number;
  height: number;
};

type DrawState = { startX: number; startY: number; currentX: number; currentY: number };

const CANVAS_WIDTH = 900;
const PYLON_SIZE_M = 0.30;
const PYLON_MIN_PX = 6;
const RULER_SIZE = 28;
const ARROW_COLOR = "#334155";
const ARROW_SELECTED = "#0284c7";
const ARROWHEAD_PX = 14;
const ENDPOINT_R = 8;
const CP_R = 6;

function arrowHeadPts(ex: number, ey: number, cpx: number, cpy: number, size: number): string {
  const a = Math.atan2(ey - cpy, ex - cpx);
  const spread = 0.55;
  return [
    `${ex},${ey}`,
    `${ex - size * Math.cos(a - spread)},${ey - size * Math.sin(a - spread)}`,
    `${ex - size * Math.cos(a + spread)},${ey - size * Math.sin(a + spread)}`,
  ].join(" ");
}

function bezierNear(px: number, py: number, a: PlacedArrow, scale: number, thresh: number): boolean {
  const sx = a.startX * scale, sy = a.startY * scale;
  const ex = a.endX * scale, ey = a.endY * scale;
  const cx = a.cpX * scale, cy = a.cpY * scale;
  for (let t = 0; t <= 1; t += 0.04) {
    const u = 1 - t;
    const bx = u * u * sx + 2 * u * t * cx + t * t * ex;
    const by = u * u * sy + 2 * u * t * cy + t * t * ey;
    if (Math.hypot(px - bx, py - by) <= thresh) return true;
  }
  return false;
}

function ArrowPath({ arrow, scale, selected, dashed }: { arrow: PlacedArrow; scale: number; selected: boolean; dashed?: boolean }) {
  const sx = arrow.startX * scale, sy = arrow.startY * scale;
  const ex = arrow.endX * scale, ey = arrow.endY * scale;
  const cx = arrow.cpX * scale, cy = arrow.cpY * scale;
  const color = selected ? ARROW_SELECTED : ARROW_COLOR;
  const d = `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`;
  const head = arrowHeadPts(ex, ey, cx, cy, ARROWHEAD_PX);
  return (
    <g>
      {selected && (
        <>
          <line x1={sx} y1={sy} x2={cx} y2={cy} stroke="#f97316" strokeWidth={1} strokeDasharray="4 3" />
          <line x1={ex} y1={ey} x2={cx} y2={cy} stroke="#f97316" strokeWidth={1} strokeDasharray="4 3" />
        </>
      )}
      <path d={d} fill="none" stroke={color} strokeWidth={3} strokeDasharray={dashed ? "8 4" : undefined} opacity={dashed ? 0.6 : 1} />
      <polygon points={head} fill={color} opacity={dashed ? 0.6 : 1} />
    </g>
  );
}

function DragHandle({ x, y, radius, fill, stroke, scale, onDrag }: {
  x: number; y: number; radius: number; fill: string; stroke: string; scale: number;
  onDrag: (dx: number, dy: number) => void;
}) {
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    let lx = e.clientX, ly = e.clientY;
    const move = (me: PointerEvent) => {
      onDrag((me.clientX - lx) / scale, (me.clientY - ly) / scale);
      lx = me.clientX; ly = me.clientY;
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        position: "absolute", left: x - radius, top: y - radius,
        width: radius * 2, height: radius * 2,
        borderRadius: "50%", background: fill, border: `2px solid ${stroke}`,
        cursor: "move", zIndex: 20, boxSizing: "border-box",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
      }}
    />
  );
}

export default function TrackCanvas(props: TrackCanvasProps) {
  const { fieldWidth, fieldLength, items, selectedIds, onSelect, onMove, onMoveMultiple,
    onFormationDragStart, onDeselectAll, issues,
    drawingArrowMode, onArrowDrawn, arrows, selectedArrowId, onSelectArrow,
    onArrowCpMove, onArrowEndpointMove, mapConfig } = props;

  // Validierungsprobleme pro Formation: höchste Severity gewinnt
  const issueByFormation = useMemo(() => {
    const map = new Map<string, "error" | "warning" | "info">();
    for (const issue of issues) {
      if (!issue.formationId) continue;
      const current = map.get(issue.formationId);
      if (!current || issue.severity === "error") map.set(issue.formationId, issue.severity);
    }
    return map;
  }, [issues]);

  const scale = CANVAS_WIDTH / fieldWidth;
  const canvasHeight = fieldLength * scale;
  const pylonPx = Math.max(PYLON_MIN_PX, PYLON_SIZE_M * scale);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [drawState, setDrawState] = useState<DrawState | null>(null);

  const prepared = useMemo<PreparedItem[]>(() => items.map((item) => {
    const formation = getFormation(item.key);
    const src = formation.cones;
    // Pre-rotate cones mathematically so the bounding box is always correct.
    // This avoids the CSS-rotation bug where an asymmetric container clips rotated content.
    const cones = item.rotationDeg !== 0 && src.length > 0
      ? rotateConesAroundOwnCenter(src, item.rotationDeg)
      : src;
    const fallback = cones.length > 0 ? cones : [{ x: 0, y: 0, kind: "standing" as const }];
    const bounds = boundsFromCones(fallback);
    const normalized = cones.map((c) => ({ ...c, x: c.x - bounds.minX + 0.4, y: c.y - bounds.minY + 0.4 }));
    return { item, formation, normalized, width: bounds.width + 0.8, height: bounds.height + 0.8 };
  }), [items]);

  const xTicks = Array.from({ length: Math.floor(fieldWidth) + 1 }, (_, i) => i);
  const yTicks = Array.from({ length: Math.floor(fieldLength) + 1 }, (_, i) => i);

  function canvasPos(e: React.MouseEvent) {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  }

  // Drag für Formationen: reiner Pointer-Event-Ansatz, kein framer-motion
  function startFormationDrag(e: React.PointerEvent<HTMLDivElement>, itemId: string) {
    if (drawingArrowMode) return;
    e.stopPropagation();

    if (e.shiftKey) {
      // Shift+Klick: nur Auswahl umschalten, kein Drag
      onSelect(itemId, true);
      return;
    }

    // Welche IDs werden verschoben: alle ausgewählten (wenn das Item dabei ist), sonst nur dieses
    const idsToMove = selectedIds.has(itemId) ? Array.from(selectedIds) : [itemId];
    if (!selectedIds.has(itemId)) onSelect(itemId, false);

    if (onFormationDragStart) onFormationDragStart();
    let lx = e.clientX, ly = e.clientY;
    let moved = false;

    const move = (me: PointerEvent) => {
      const dx = (me.clientX - lx) / scale;
      const dy = (me.clientY - ly) / scale;
      if (dx !== 0 || dy !== 0) {
        moved = true;
        idsToMove.length === 1
          ? onMove(idsToMove[0], dx, dy)
          : onMoveMultiple(idsToMove, dx, dy);
      }
      lx = me.clientX; ly = me.clientY;
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      // Klick ohne Drag auf bereits ausgewähltem Element → Auswahl auf nur dieses reduzieren
      if (!moved && selectedIds.has(itemId) && selectedIds.size > 1) {
        onSelect(itemId, false);
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function onCanvasMouseDown(e: React.MouseEvent) {
    if (!drawingArrowMode) return;
    e.preventDefault();
    const p = canvasPos(e);
    setDrawState({ startX: p.x, startY: p.y, currentX: p.x, currentY: p.y });
  }

  function onCanvasMouseMove(e: React.MouseEvent) {
    if (!drawState) return;
    const p = canvasPos(e);
    setDrawState((s) => s ? { ...s, currentX: p.x, currentY: p.y } : null);
  }

  function onCanvasMouseUp(e: React.MouseEvent) {
    if (!drawState) return;
    const p = canvasPos(e);
    if (Math.hypot((p.x - drawState.startX) * scale, (p.y - drawState.startY) * scale) > 8) {
      onArrowDrawn({
        startX: drawState.startX, startY: drawState.startY,
        endX: p.x, endY: p.y,
        cpX: (drawState.startX + p.x) / 2, cpY: (drawState.startY + p.y) / 2,
      });
    }
    setDrawState(null);
  }

  function onCanvasClick(e: React.MouseEvent) {
    if (drawingArrowMode) return;
    const p = canvasPos(e);
    const hit = arrows.find((a) => bezierNear(p.x * scale, p.y * scale, a, scale, 12));
    if (hit) onSelectArrow(hit.id);
    else {
      onSelectArrow(null);
      onDeselectAll?.();
    }
  }

  const preview: PlacedArrow | null = drawState ? {
    id: "__preview__",
    startX: drawState.startX, startY: drawState.startY,
    endX: drawState.currentX, endY: drawState.currentY,
    cpX: (drawState.startX + drawState.currentX) / 2,
    cpY: (drawState.startY + drawState.currentY) / 2,
  } : null;

  const selectedArrow = arrows.find((a) => a.id === selectedArrowId) ?? null;

  return (
    <div style={{ overflow: "auto", border: "1px solid #cbd5e1", borderRadius: 20, padding: 12, background: "#f8fafc" }}>
      <div style={{ position: "relative", width: CANVAS_WIDTH + RULER_SIZE, height: canvasHeight + RULER_SIZE }}>

        {/* X-Lineal */}
        <div style={{ position: "absolute", left: RULER_SIZE, top: 0, width: CANVAS_WIDTH, height: RULER_SIZE, background: "#e2e8f0", borderBottom: "1px solid #94a3b8", overflow: "hidden" }}>
          {xTicks.map((t) => (
            <div key={`x-${t}`} style={{ position: "absolute", left: t * scale, top: 0, height: RULER_SIZE, width: 1 }}>
              <div style={{ position: "absolute", left: 0, top: RULER_SIZE - 10, width: 1, height: 10, background: "#475569" }} />
              <div style={{ position: "absolute", left: 3, top: 4, fontSize: 10, color: "#334155" }}>{t}</div>
            </div>
          ))}
        </div>

        {/* Y-Lineal */}
        <div style={{ position: "absolute", left: 0, top: RULER_SIZE, width: RULER_SIZE, height: canvasHeight, background: "#e2e8f0", borderRight: "1px solid #94a3b8", overflow: "hidden" }}>
          {yTicks.map((t) => (
            <div key={`y-${t}`} style={{ position: "absolute", left: 0, top: t * scale, width: RULER_SIZE, height: 1 }}>
              <div style={{ position: "absolute", left: RULER_SIZE - 10, top: 0, width: 10, height: 1, background: "#475569" }} />
              <div style={{ position: "absolute", left: 2, top: 2, fontSize: 10, color: "#334155" }}>{t}</div>
            </div>
          ))}
        </div>

        {/* Ecke */}
        <div style={{ position: "absolute", left: 0, top: 0, width: RULER_SIZE, height: RULER_SIZE, background: "#cbd5e1", borderRight: "1px solid #94a3b8", borderBottom: "1px solid #94a3b8" }} />

        {/* Canvas */}
        <div
          ref={canvasRef}
          onMouseDown={onCanvasMouseDown}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={onCanvasMouseUp}
          onClick={onCanvasClick}
          style={{
            position: "absolute", left: RULER_SIZE, top: RULER_SIZE,
            width: CANVAS_WIDTH, height: canvasHeight,
            outline: "4px solid #020617", outlineOffset: "-4px",
            background: "white", overflow: "hidden", borderRadius: 16,
            cursor: drawingArrowMode ? "crosshair" : "default",
            userSelect: "none",
          }}
        >
          {/* Kartenhintergrund */}
          {mapConfig && (
            <MapBackground
              selection={mapConfig.selection}
              canvasWidthPx={CANVAS_WIDTH}
              canvasHeightPx={canvasHeight}
              satellite={mapConfig.satellite}
              opacity={mapConfig.opacity}
            />
          )}

          {/* Gitter */}
          <div style={{
            position: "absolute", inset: 0, opacity: mapConfig ? 0.15 : 0.35, pointerEvents: "none",
            backgroundImage: "linear-gradient(to right, #cbd5e1 1px, transparent 1px), linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)",
            backgroundSize: `${scale}px ${scale}px`,
          }} />

          {/* Formationen — reines Pointer-Event-Drag, kein framer-motion */}
          {prepared.map(({ item, formation, normalized, width, height }) => {
            const boxW = Math.max(1, width) * scale;
            const boxH = Math.max(1, height) * scale;
            const isSelected = selectedIds.has(item.id);
            const severity = issueByFormation.get(item.id);

            // Border-Priorität: Selektion > Fehler > Warnung > neutral
            let border = "1px dashed transparent";
            let bg = "transparent";
            if (isSelected) { border = "2px dashed #0284c7"; bg = "rgba(14,165,233,0.05)"; }
            else if (severity === "error") { border = "2px solid #ef4444"; bg = "rgba(239,68,68,0.05)"; }
            else if (severity === "warning") { border = "2px solid #f59e0b"; bg = "rgba(245,158,11,0.05)"; }

            return (
              <div
                key={item.id}
                onPointerDown={(e) => startFormationDrag(e, item.id)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  left: item.x * scale,
                  top: item.y * scale,
                  width: boxW,
                  height: boxH,
                  cursor: drawingArrowMode ? "crosshair" : "grab",
                  border,
                  borderRadius: 16,
                  boxSizing: "border-box",
                  background: bg,
                  touchAction: "none",
                }}
              >

                {formation.areaLabel && (() => {
                  const srcNonSensor = formation.cones.filter((c) => c.kind !== "sensor");
                  if (srcNonSensor.length === 0) return null;
                  const srcMinX = Math.min(...srcNonSensor.map((c) => c.x));
                  const srcMaxX = Math.max(...srcNonSensor.map((c) => c.x));
                  const srcMinY = Math.min(...srcNonSensor.map((c) => c.y));
                  const srcMaxY = Math.max(...srcNonSensor.map((c) => c.y));
                  const areaW = (srcMaxX - srcMinX) * scale;
                  const areaH = (srcMaxY - srcMinY) * scale;
                  const centerX = (width / 2) * scale;
                  const centerY = (height / 2) * scale;
                  const fontSize = Math.max(9, Math.min(areaW * 0.18, 18));
                  return (
                    <div style={{
                      position: "absolute",
                      left: centerX - areaW / 2,
                      top: centerY - areaH / 2,
                      width: areaW,
                      height: areaH,
                      transform: `rotate(${item.rotationDeg}deg)`,
                      transformOrigin: "50% 50%",
                      background: formation.areaColor ? `${formation.areaColor}55` : "rgba(254,240,138,0.33)",
                      border: `2px solid ${formation.areaColor ?? "#fef08a"}`,
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      pointerEvents: "none",
                      fontSize,
                      fontWeight: 700,
                      color: "#1e293b",
                      letterSpacing: 0.5,
                      boxSizing: "border-box",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                    }}>
                      {formation.hasStartLine && (
                        <div style={{
                          position: "absolute",
                          left: "8%",
                          right: "8%",
                          top: 0,
                          height: 3,
                          background: "#0f172a",
                          borderRadius: 2,
                        }} />
                      )}
                      {formation.areaLabel}
                    </div>
                  );
                })()}

                {(formation.hasStartLine || formation.hasFinishLine) && !formation.areaLabel && (() => {
                  const srcCones = formation.cones.filter((c) => c.kind !== "sensor");
                  if (srcCones.length === 0) return null;
                  const srcMinX = Math.min(...srcCones.map((c) => c.x));
                  const srcMaxX = Math.max(...srcCones.map((c) => c.x));
                  const srcMinY = Math.min(...srcCones.map((c) => c.y));
                  const srcMaxY = Math.max(...srcCones.map((c) => c.y));
                  const fmtW = (srcMaxX - srcMinX) * scale;
                  const fmtH = (srcMaxY - srcMinY) * scale;
                  const centerX = (width / 2) * scale;
                  const centerY = (height / 2) * scale;
                  return (
                    <div style={{
                      position: "absolute",
                      left: centerX - fmtW / 2,
                      top: centerY - fmtH / 2,
                      width: fmtW,
                      height: fmtH,
                      transform: `rotate(${item.rotationDeg}deg)`,
                      transformOrigin: "50% 50%",
                      pointerEvents: "none",
                    }}>
                      {formation.hasStartLine && (
                        <div style={{
                          position: "absolute",
                          left: "8%", right: "8%",
                          top: 0,
                          height: 3,
                          background: "#0f172a",
                          borderRadius: 2,
                        }} />
                      )}
                      {formation.hasFinishLine && (
                        <div style={{
                          position: "absolute",
                          left: "8%", right: "8%",
                          bottom: 0,
                          height: 3,
                          background: "#0f172a",
                          borderRadius: 2,
                        }} />
                      )}
                    </div>
                  );
                })()}

                {normalized.map((cone, i) => {
                  const cx = cone.x * scale, cy = cone.y * scale;

                  if (cone.kind === "sensor") {
                    const r = Math.max(5, pylonPx * 0.7);
                    return (
                      <div key={i} style={{
                        position: "absolute",
                        left: cx - r / 2,
                        top: cy - r / 2,
                        width: r, height: r,
                        borderRadius: "50%",
                        background: "#0f172a",
                        border: "1.5px solid #475569",
                        boxSizing: "border-box",
                        pointerEvents: "none",
                      }} />
                    );
                  }

                  if (cone.kind === "lying") {
                    return (
                      <div key={i} style={{
                        position: "absolute",
                        left: cx - pylonPx / 2,
                        top: cy - pylonPx / 2,
                        width: 0, height: 0,
                        borderLeft: `${pylonPx / 2}px solid transparent`,
                        borderRight: `${pylonPx / 2}px solid transparent`,
                        borderBottom: `${pylonPx}px solid #334155`,
                        pointerEvents: "none",
                        transform: `rotate(${cone.angleDeg ?? 0}deg)`,
                        transformOrigin: "center center",
                      }} />
                    );
                  }

                  return (
                    <div key={i} style={{
                      position: "absolute",
                      left: cx - pylonPx / 2,
                      top: cy - pylonPx / 2,
                      width: pylonPx, height: pylonPx,
                      borderRadius: "3px",
                      background: "#f97316",
                      border: "1px solid #9a3412",
                      boxSizing: "border-box",
                      pointerEvents: "none",
                      transform: cone.angleDeg ? `rotate(${cone.angleDeg}deg)` : undefined,
                      transformOrigin: "center center",
                    }} />
                  );
                })}
              </div>
            );
          })}

          {/* SVG-Overlay: Pfeile (nur visuell) */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
            {arrows.map((a) => (
              <ArrowPath key={a.id} arrow={a} scale={scale} selected={selectedArrowId === a.id} />
            ))}
            {preview && <ArrowPath arrow={preview} scale={scale} selected={false} dashed />}
          </svg>

          {/* HTML-Handles für selektierten Pfeil */}
          {selectedArrow && (
            <>
              <DragHandle x={selectedArrow.startX * scale} y={selectedArrow.startY * scale} radius={ENDPOINT_R} fill="white" stroke={ARROW_SELECTED} scale={scale} onDrag={(dx, dy) => onArrowEndpointMove(selectedArrow.id, "start", dx, dy)} />
              <DragHandle x={selectedArrow.endX * scale} y={selectedArrow.endY * scale} radius={ENDPOINT_R} fill="white" stroke={ARROW_SELECTED} scale={scale} onDrag={(dx, dy) => onArrowEndpointMove(selectedArrow.id, "end", dx, dy)} />
              <DragHandle x={selectedArrow.cpX * scale} y={selectedArrow.cpY * scale} radius={CP_R} fill="#f97316" stroke="white" scale={scale} onDrag={(dx, dy) => onArrowCpMove(selectedArrow.id, dx, dy)} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
