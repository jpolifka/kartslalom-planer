// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useRef, useState } from "react";
import type { PlacedArrow } from "../../types";
import type { EditableCone, EditorAction } from "../../hooks/useFormationEditor";
import { PYLON_FOOT_SIZE, PYLON_SPACING, TASK_LANE_WIDTH } from "../../lib/formations/common";

export type EditorTool = "select" | "standing" | "lying" | "sensor" | "arrow" | "gatePair";

const CANVAS_M = 10;
const CANVAS_PX = 560;
const SCALE = CANVAS_PX / CANVAS_M;
const CONE_R = Math.max(6, (PYLON_FOOT_SIZE / 2) * SCALE);
const GRID_COLOR = "#e5e7eb";
const BG_COLOR = "#f9fafb";

const CONE_COLORS: Record<string, string> = {
  standing: "#e74c3c",
  lying: "#f39c12",
  sensor: "#3b82f6",
};

type ArrowDrawing = { startX: number; startY: number; curX: number; curY: number };

type Props = {
  cones: EditableCone[];
  arrows: PlacedArrow[];
  selectedConeIds: string[];
  selectedArrowId: string | null;
  tool: EditorTool;
  gatePairIds: [string, string] | null;
  dispatch: React.Dispatch<EditorAction>;
  onSelectCones: (ids: string[]) => void;
  onSelectArrow: (id: string | null) => void;
  onGatePairClick: (coneId: string) => void;
};

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

export default function FormationEditorCanvas({
  cones,
  arrows,
  selectedConeIds,
  selectedArrowId,
  tool,
  gatePairIds,
  dispatch,
  onSelectCones,
  onSelectArrow,
  onGatePairClick,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const [arrowDraw, setArrowDraw] = useState<ArrowDrawing | null>(null);
  const [arrowDragCp, setArrowDragCp] = useState<{ id: string; ox: number; oy: number } | null>(null);

  function toMeters(clientX: number, clientY: number) {
    const r = svgRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(CANVAS_M, ((clientX - r.left) / r.width) * CANVAS_M)),
      y: Math.max(0, Math.min(CANVAS_M, ((clientY - r.top) / r.height) * CANVAS_M)),
    };
  }

  function handleBgPointerDown(e: React.PointerEvent<SVGRectElement>) {
    const pos = toMeters(e.clientX, e.clientY);
    if (tool === "standing" || tool === "lying" || tool === "sensor") {
      dispatch({
        type: "ADD_CONE",
        cone: { id: crypto.randomUUID(), x: pos.x, y: pos.y, kind: tool },
      });
      return;
    }
    if (tool === "arrow") {
      setArrowDraw({ startX: pos.x, startY: pos.y, curX: pos.x, curY: pos.y });
      (e.target as SVGElement).setPointerCapture(e.pointerId);
      return;
    }
    onSelectCones([]);
    onSelectArrow(null);
  }

  function handleBgPointerMove(e: React.PointerEvent<SVGRectElement>) {
    if (!arrowDraw) return;
    const pos = toMeters(e.clientX, e.clientY);
    setArrowDraw((prev) => prev ? { ...prev, curX: pos.x, curY: pos.y } : null);
  }

  function handleBgPointerUp(e: React.PointerEvent<SVGRectElement>) {
    if (arrowDraw) {
      const pos = toMeters(e.clientX, e.clientY);
      const sx = arrowDraw.startX, sy = arrowDraw.startY;
      if (dist(sx, sy, pos.x, pos.y) > 0.1) {
        dispatch({
          type: "ADD_ARROW",
          arrow: {
            id: crypto.randomUUID(),
            startX: sx, startY: sy,
            endX: pos.x, endY: pos.y,
            cpX: (sx + pos.x) / 2, cpY: (sy + pos.y) / 2,
          },
        });
      }
      setArrowDraw(null);
    }
  }

  function handleConePointerDown(e: React.PointerEvent<SVGElement>, cone: EditableCone) {
    e.stopPropagation();
    if (tool === "gatePair") {
      onGatePairClick(cone.id);
      return;
    }
    if (tool !== "select") return;
    if (e.shiftKey) {
      onSelectCones(
        selectedConeIds.includes(cone.id)
          ? selectedConeIds.filter((id) => id !== cone.id)
          : [...selectedConeIds, cone.id]
      );
    } else {
      if (!selectedConeIds.includes(cone.id)) onSelectCones([cone.id]);
    }
    onSelectArrow(null);
    dispatch({ type: "CHECKPOINT" });
    setDrag({ id: cone.id, ox: 0, oy: 0 });
    (e.target as SVGElement).setPointerCapture(e.pointerId);
  }

  function handleSvgPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drag) return;
    const pos = toMeters(e.clientX, e.clientY);
    const cone = cones.find((c) => c.id === drag.id);
    if (!cone) return;
    dispatch({ type: "MOVE_CONE", id: drag.id, x: pos.x, y: pos.y });
  }

  function handleSvgPointerUp() {
    setDrag(null);
    setArrowDragCp(null);
  }

  function handleCpPointerDown(e: React.PointerEvent<SVGCircleElement>, arrow: PlacedArrow) {
    e.stopPropagation();
    onSelectArrow(arrow.id);
    setArrowDragCp({ id: arrow.id, ox: e.clientX, oy: e.clientY });
    (e.target as SVGElement).setPointerCapture(e.pointerId);
  }

  function handleSvgPointerMoveForCp(e: React.PointerEvent<SVGSVGElement>) {
    if (!arrowDragCp) return;
    const r = svgRef.current!.getBoundingClientRect();
    const actualScale = r.width / CANVAS_M;
    const dx = (e.clientX - arrowDragCp.ox) / actualScale;
    const dy = (e.clientY - arrowDragCp.oy) / actualScale;
    dispatch({ type: "MOVE_ARROW_CP", id: arrowDragCp.id, dx, dy });
    setArrowDragCp({ ...arrowDragCp, ox: e.clientX, oy: e.clientY });
  }

  function onSvgPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    handleSvgPointerMove(e);
    handleSvgPointerMoveForCp(e);
  }

  // Rule: cone too close (center-to-center < PYLON_SPACING = 0.8m)
  const tooClosePairs: [EditableCone, EditableCone][] = [];
  for (let i = 0; i < cones.length; i++) {
    for (let j = i + 1; j < cones.length; j++) {
      if (dist(cones[i].x, cones[i].y, cones[j].x, cones[j].y) < PYLON_SPACING) {
        tooClosePairs.push([cones[i], cones[j]]);
      }
    }
  }

  // Gate pair visualization
  const gpCone0 = gatePairIds ? cones.find((c) => c.id === gatePairIds[0]) : null;
  const gpCone1 = gatePairIds ? cones.find((c) => c.id === gatePairIds[1]) : null;
  const lichteBreite =
    gpCone0 && gpCone1
      ? dist(gpCone0.x, gpCone0.y, gpCone1.x, gpCone1.y) - PYLON_FOOT_SIZE
      : null;
  const gatePairWarning = lichteBreite !== null && lichteBreite < TASK_LANE_WIDTH;

  // Grid lines
  const gridLines: React.ReactNode[] = [];
  for (let i = 0; i <= CANVAS_M; i++) {
    const p = i * SCALE;
    gridLines.push(<line key={`h${i}`} x1={0} y1={p} x2={CANVAS_PX} y2={p} stroke={GRID_COLOR} strokeWidth={1} />);
    gridLines.push(<line key={`v${i}`} x1={p} y1={0} x2={p} y2={CANVAS_PX} stroke={GRID_COLOR} strokeWidth={1} />);
  }

  return (
    <svg
      ref={svgRef}
      width={CANVAS_PX}
      height={CANVAS_PX}
      style={{ display: "block", cursor: tool === "select" ? "default" : "crosshair", userSelect: "none" }}
      onPointerMove={onSvgPointerMove}
      onPointerUp={handleSvgPointerUp}
    >
      {/* Background + grid */}
      <rect width={CANVAS_PX} height={CANVAS_PX} fill={BG_COLOR} />
      {gridLines}
      {/* Interactive background for placement/deselect */}
      <rect
        width={CANVAS_PX}
        height={CANVAS_PX}
        fill="transparent"
        onPointerDown={handleBgPointerDown}
        onPointerMove={handleBgPointerMove}
        onPointerUp={handleBgPointerUp}
        style={{ cursor: tool === "select" ? "default" : "crosshair" }}
      />

      {/* Rule overlays: too-close pairs */}
      {tooClosePairs.map(([a, b], i) => (
        <line
          key={`tc${i}`}
          x1={a.x * SCALE} y1={a.y * SCALE}
          x2={b.x * SCALE} y2={b.y * SCALE}
          stroke="#f59e0b" strokeWidth={3} strokeDasharray="4 3" strokeLinecap="round"
          pointerEvents="none"
        />
      ))}

      {/* Gate pair line */}
      {gpCone0 && gpCone1 && (
        <>
          <line
            x1={gpCone0.x * SCALE} y1={gpCone0.y * SCALE}
            x2={gpCone1.x * SCALE} y2={gpCone1.y * SCALE}
            stroke={gatePairWarning ? "#ef4444" : "#22c55e"}
            strokeWidth={2} strokeDasharray="6 3" pointerEvents="none"
          />
          <text
            x={((gpCone0.x + gpCone1.x) / 2) * SCALE}
            y={((gpCone0.y + gpCone1.y) / 2) * SCALE - 8}
            textAnchor="middle"
            fontSize={11}
            fill={gatePairWarning ? "#ef4444" : "#22c55e"}
            fontWeight="600"
            pointerEvents="none"
          >
            {lichteBreite!.toFixed(2)} m{gatePairWarning ? " ⚠" : ""}
          </text>
        </>
      )}

      {/* Arrows */}
      {arrows.map((a) => {
        const sel = a.id === selectedArrowId;
        return (
          <g key={a.id} onClick={() => onSelectArrow(a.id)} style={{ cursor: "pointer" }}>
            <path
              d={`M ${a.startX * SCALE} ${a.startY * SCALE} Q ${a.cpX * SCALE} ${a.cpY * SCALE} ${a.endX * SCALE} ${a.endY * SCALE}`}
              fill="none"
              stroke={sel ? "#2563eb" : "#334155"}
              strokeWidth={sel ? 2.5 : 2}
              markerEnd="url(#arrowhead)"
            />
            {sel && (
              <circle
                cx={a.cpX * SCALE} cy={a.cpY * SCALE} r={6}
                fill="#2563eb" stroke="white" strokeWidth={1.5}
                style={{ cursor: "grab" }}
                onPointerDown={(e) => handleCpPointerDown(e, a)}
              />
            )}
          </g>
        );
      })}

      {/* Arrow preview while drawing */}
      {arrowDraw && (
        <line
          x1={arrowDraw.startX * SCALE} y1={arrowDraw.startY * SCALE}
          x2={arrowDraw.curX * SCALE} y2={arrowDraw.curY * SCALE}
          stroke="#2563eb" strokeWidth={1.5} strokeDasharray="4 3"
          pointerEvents="none"
        />
      )}

      {/* Cones */}
      {cones.map((cone) => {
        const cx = cone.x * SCALE;
        const cy = cone.y * SCALE;
        const sel = selectedConeIds.includes(cone.id);
        const inGatePair = gatePairIds?.includes(cone.id);
        const fillColor = inGatePair ? "#22c55e" : CONE_COLORS[cone.kind];
        const strokeColor = sel ? "#2563eb" : inGatePair ? "#16a34a" : "white";
        const strokeW = sel || inGatePair ? 2.5 : 1.5;

        if (cone.kind === "lying") {
          const w = PYLON_FOOT_SIZE * SCALE * 0.6;
          const h = PYLON_FOOT_SIZE * SCALE * 1.8;
          const angle = cone.angleDeg ?? 0;
          return (
            <g
              key={cone.id}
              transform={`rotate(${angle}, ${cx}, ${cy})`}
              style={{ cursor: tool === "select" ? "move" : "crosshair" }}
              onPointerDown={(e) => handleConePointerDown(e, cone)}
            >
              <rect
                x={cx - w / 2} y={cy - h / 2}
                width={w} height={h}
                fill={fillColor} stroke={strokeColor} strokeWidth={strokeW} rx={2}
              />
              {/* Small triangle at "front" end to show orientation */}
              <polygon
                points={`${cx},${cy - h / 2 - 5} ${cx - 4},${cy - h / 2 + 1} ${cx + 4},${cy - h / 2 + 1}`}
                fill={strokeColor}
                pointerEvents="none"
              />
            </g>
          );
        }

        if (cone.kind === "sensor") {
          return (
            <circle
              key={cone.id}
              cx={cx} cy={cy} r={CONE_R}
              fill="transparent" stroke={sel ? "#2563eb" : "#3b82f6"}
              strokeWidth={strokeW} strokeDasharray="4 2"
              style={{ cursor: tool === "select" ? "move" : "crosshair" }}
              onPointerDown={(e) => handleConePointerDown(e, cone)}
            />
          );
        }

        return (
          <circle
            key={cone.id}
            cx={cx} cy={cy} r={CONE_R}
            fill={fillColor} stroke={strokeColor} strokeWidth={strokeW}
            style={{ cursor: tool === "select" ? "move" : "crosshair" }}
            onPointerDown={(e) => handleConePointerDown(e, cone)}
          />
        );
      })}

      <defs>
        <marker id="arrowhead" markerWidth={6} markerHeight={4} refX={5} refY={2} orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill="#334155" />
        </marker>
      </defs>
    </svg>
  );
}
