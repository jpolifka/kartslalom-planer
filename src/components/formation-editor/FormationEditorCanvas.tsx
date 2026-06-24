// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useRef, useState } from "react";
import type { PlacedArrow } from "../../types";
import type { EditableCone, EditorAction } from "../../hooks/useFormationEditor";
import { PYLON_FOOT_SIZE, PYLON_SPACING, TASK_LANE_WIDTH } from "../../lib/formations/common";

export type EditorTool = "select" | "standing" | "lying" | "sensor" | "arrow" | "gatePair";

// Internal SVG coordinate space — constant, never changes.
// visibleM controls how many real-world meters fit into this space.
const CANVAS_PX = 560;
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
  visibleM: number;
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
  visibleM,
  dispatch,
  onSelectCones,
  onSelectArrow,
  onGatePairClick,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string } | null>(null);
  const [arrowDraw, setArrowDraw] = useState<ArrowDrawing | null>(null);
  const [arrowDragCp, setArrowDragCp] = useState<{ id: string; ox: number; oy: number } | null>(null);

  // Pixels per meter in SVG-viewBox space
  const S = CANVAS_PX / visibleM;
  // Cone radius: proportional to pylon foot, minimum 4px so tiny zooms stay clickable
  const coneR = Math.max(4, (PYLON_FOOT_SIZE / 2) * S);

  function toMeters(clientX: number, clientY: number) {
    const r = svgRef.current!.getBoundingClientRect();
    // preserveAspectRatio="xMidYMid meet" centers the content in the SVG DOM box.
    // When the DOM box is not square, subtract the letterbox/pillarbox offset.
    const size = Math.min(r.width, r.height);
    const ox = (r.width - size) / 2;
    const oy = (r.height - size) / 2;
    return {
      x: Math.max(0, Math.min(visibleM, ((clientX - r.left - ox) / size) * visibleM)),
      y: Math.max(0, Math.min(visibleM, ((clientY - r.top - oy) / size) * visibleM)),
    };
  }

  function handleBgPointerDown(e: React.PointerEvent<SVGRectElement>) {
    const pos = toMeters(e.clientX, e.clientY);
    if (tool === "standing" || tool === "lying" || tool === "sensor") {
      dispatch({ type: "ADD_CONE", cone: { id: crypto.randomUUID(), x: pos.x, y: pos.y, kind: tool } });
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
      const { startX: sx, startY: sy } = arrowDraw;
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
    if (tool === "gatePair") { onGatePairClick(cone.id); return; }
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
    setDrag({ id: cone.id });
    (e.target as SVGElement).setPointerCapture(e.pointerId);
  }

  function handleSvgPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (drag) {
      const pos = toMeters(e.clientX, e.clientY);
      dispatch({ type: "MOVE_CONE", id: drag.id, x: pos.x, y: pos.y });
    }
    if (arrowDragCp) {
      const r = svgRef.current!.getBoundingClientRect();
      const actualScale = Math.min(r.width, r.height) / visibleM;
      const dx = (e.clientX - arrowDragCp.ox) / actualScale;
      const dy = (e.clientY - arrowDragCp.oy) / actualScale;
      dispatch({ type: "MOVE_ARROW_CP", id: arrowDragCp.id, dx, dy });
      setArrowDragCp({ ...arrowDragCp, ox: e.clientX, oy: e.clientY });
    }
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

  // Too-close cone pairs
  const tooClosePairs: [EditableCone, EditableCone][] = [];
  for (let i = 0; i < cones.length; i++) {
    for (let j = i + 1; j < cones.length; j++) {
      if (dist(cones[i].x, cones[i].y, cones[j].x, cones[j].y) < PYLON_SPACING) {
        tooClosePairs.push([cones[i], cones[j]]);
      }
    }
  }

  // Gate pair
  const gpCone0 = gatePairIds ? cones.find((c) => c.id === gatePairIds[0]) : null;
  const gpCone1 = gatePairIds ? cones.find((c) => c.id === gatePairIds[1]) : null;
  const lichteBreite = gpCone0 && gpCone1
    ? dist(gpCone0.x, gpCone0.y, gpCone1.x, gpCone1.y) - PYLON_FOOT_SIZE
    : null;
  const gatePairWarning = lichteBreite !== null && lichteBreite < TASK_LANE_WIDTH;

  // Grid: 1m lines, plus a thicker 5m line
  const gridLines: React.ReactNode[] = [];
  for (let i = 0; i <= visibleM; i++) {
    const p = i * S;
    const isMajor = i % 5 === 0;
    const stroke = isMajor ? "#d1d5db" : GRID_COLOR;
    const sw = isMajor ? 1.5 : 1;
    gridLines.push(<line key={`h${i}`} x1={0} y1={p} x2={CANVAS_PX} y2={p} stroke={stroke} strokeWidth={sw} />);
    gridLines.push(<line key={`v${i}`} x1={p} y1={0} x2={p} y2={CANVAS_PX} stroke={stroke} strokeWidth={sw} />);
    // Meter labels on major lines
    if (isMajor && i > 0) {
      gridLines.push(
        <text key={`lh${i}`} x={4} y={p - 3} fontSize={Math.max(8, S * 0.15)} fill="#9ca3af">{i} m</text>
      );
    }
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${CANVAS_PX} ${CANVAS_PX}`}
      style={{ display: "block", width: "100%", maxHeight: "100%", aspectRatio: "1", cursor: tool === "select" ? "default" : "crosshair", userSelect: "none" }}
      onPointerMove={handleSvgPointerMove}
      onPointerUp={handleSvgPointerUp}
    >
      <rect width={CANVAS_PX} height={CANVAS_PX} fill={BG_COLOR} />
      {gridLines}
      <rect
        width={CANVAS_PX} height={CANVAS_PX} fill="transparent"
        onPointerDown={handleBgPointerDown}
        onPointerMove={handleBgPointerMove}
        onPointerUp={handleBgPointerUp}
        style={{ cursor: tool === "select" ? "default" : "crosshair" }}
      />

      {/* Too-close pairs */}
      {tooClosePairs.map(([a, b], i) => (
        <line
          key={`tc${i}`}
          x1={a.x * S} y1={a.y * S} x2={b.x * S} y2={b.y * S}
          stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 3" strokeLinecap="round"
          pointerEvents="none"
        />
      ))}

      {/* Gate pair */}
      {gpCone0 && gpCone1 && (
        <>
          <line
            x1={gpCone0.x * S} y1={gpCone0.y * S} x2={gpCone1.x * S} y2={gpCone1.y * S}
            stroke={gatePairWarning ? "#ef4444" : "#22c55e"}
            strokeWidth={2} strokeDasharray="6 3" pointerEvents="none"
          />
          <text
            x={((gpCone0.x + gpCone1.x) / 2) * S}
            y={((gpCone0.y + gpCone1.y) / 2) * S - 6}
            textAnchor="middle" fontSize={Math.max(9, S * 0.18)}
            fill={gatePairWarning ? "#ef4444" : "#22c55e"} fontWeight="600"
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
              d={`M ${a.startX * S} ${a.startY * S} Q ${a.cpX * S} ${a.cpY * S} ${a.endX * S} ${a.endY * S}`}
              fill="none" stroke={sel ? "#2563eb" : "#334155"} strokeWidth={sel ? 2.5 : 2}
              markerEnd="url(#arrowhead)"
            />
            {sel && (
              <circle
                cx={a.cpX * S} cy={a.cpY * S} r={6}
                fill="#2563eb" stroke="white" strokeWidth={1.5}
                style={{ cursor: "grab" }}
                onPointerDown={(e) => handleCpPointerDown(e, a)}
              />
            )}
          </g>
        );
      })}

      {/* Arrow preview */}
      {arrowDraw && (
        <line
          x1={arrowDraw.startX * S} y1={arrowDraw.startY * S}
          x2={arrowDraw.curX * S} y2={arrowDraw.curY * S}
          stroke="#2563eb" strokeWidth={1.5} strokeDasharray="4 3" pointerEvents="none"
        />
      )}

      {/* Cones */}
      {cones.map((cone) => {
        const cx = cone.x * S;
        const cy = cone.y * S;
        const sel = selectedConeIds.includes(cone.id);
        const inGP = gatePairIds?.includes(cone.id);
        const fill = inGP ? "#22c55e" : CONE_COLORS[cone.kind];
        const stroke = sel ? "#2563eb" : inGP ? "#16a34a" : "white";
        const sw = sel || inGP ? 2.5 : 1.5;

        if (cone.kind === "lying") {
          const w = PYLON_FOOT_SIZE * S * 0.6;
          const h = PYLON_FOOT_SIZE * S * 1.8;
          const angle = cone.angleDeg ?? 0;
          const tri = Math.max(3, h * 0.25);
          return (
            <g
              key={cone.id}
              transform={`rotate(${angle}, ${cx}, ${cy})`}
              style={{ cursor: tool === "select" ? "move" : "crosshair" }}
              onPointerDown={(e) => handleConePointerDown(e, cone)}
            >
              <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={sw} rx={2} />
              <polygon
                points={`${cx},${cy - h / 2 - tri} ${cx - tri * 0.6},${cy - h / 2 + tri * 0.3} ${cx + tri * 0.6},${cy - h / 2 + tri * 0.3}`}
                fill={stroke} pointerEvents="none"
              />
            </g>
          );
        }

        if (cone.kind === "sensor") {
          return (
            <circle
              key={cone.id} cx={cx} cy={cy} r={coneR}
              fill="transparent" stroke={sel ? "#2563eb" : "#3b82f6"}
              strokeWidth={sw} strokeDasharray="4 2"
              style={{ cursor: tool === "select" ? "move" : "crosshair" }}
              onPointerDown={(e) => handleConePointerDown(e, cone)}
            />
          );
        }

        return (
          <circle
            key={cone.id} cx={cx} cy={cy} r={coneR}
            fill={fill} stroke={stroke} strokeWidth={sw}
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
