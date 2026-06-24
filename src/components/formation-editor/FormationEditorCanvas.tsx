// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useRef, useState } from "react";
import type { PlacedArrow } from "../../types";
import type { EditableCone, EditorAction } from "../../hooks/useFormationEditor";
import { PYLON_FOOT_SIZE, PYLON_SPACING } from "../../lib/formations/common";

export type EditorTool = "select" | "standing" | "lying" | "sensor" | "arrow" | "gatePair";

export type MeasurementLine = { id: string; x1: number; y1: number; x2: number; y2: number };

const CANVAS_PX = 560;
const GRID_COLOR = "#e5e7eb";
const BG_COLOR = "#f9fafb";

const CONE_COLORS: Record<string, string> = {
  standing: "#e74c3c",
  lying: "#f39c12",
  sensor: "#3b82f6",
};

type LineDraw = { startX: number; startY: number; curX: number; curY: number };

type Props = {
  cones: EditableCone[];
  arrows: PlacedArrow[];
  measurements: MeasurementLine[];
  selectedConeIds: string[];
  selectedArrowId: string | null;
  selectedMeasurementId: string | null;
  tool: EditorTool;
  visibleM: number;
  dispatch: React.Dispatch<EditorAction>;
  onSelectCones: (ids: string[]) => void;
  onSelectArrow: (id: string | null) => void;
  onSelectMeasurement: (id: string | null) => void;
  onAddMeasurement: (m: MeasurementLine) => void;
  onGatePairClick: (coneId: string) => void; // kept for compat, unused
};

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

export default function FormationEditorCanvas({
  cones, arrows, measurements,
  selectedConeIds, selectedArrowId, selectedMeasurementId,
  tool, visibleM, dispatch,
  onSelectCones, onSelectArrow, onSelectMeasurement, onAddMeasurement,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string } | null>(null);
  const [arrowDraw, setArrowDraw] = useState<LineDraw | null>(null);
  const [measureDraw, setMeasureDraw] = useState<LineDraw | null>(null);
  const [arrowDragCp, setArrowDragCp] = useState<{ id: string; ox: number; oy: number } | null>(null);

  const S = CANVAS_PX / visibleM;
  const coneR = Math.max(4, (PYLON_FOOT_SIZE / 2) * S);

  function toMeters(clientX: number, clientY: number) {
    const r = svgRef.current!.getBoundingClientRect();
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
    if (tool === "gatePair") {
      setMeasureDraw({ startX: pos.x, startY: pos.y, curX: pos.x, curY: pos.y });
      (e.target as SVGElement).setPointerCapture(e.pointerId);
      return;
    }
    onSelectCones([]);
    onSelectArrow(null);
    onSelectMeasurement(null);
  }

  function handleBgPointerMove(e: React.PointerEvent<SVGRectElement>) {
    const pos = toMeters(e.clientX, e.clientY);
    if (arrowDraw) setArrowDraw((prev) => prev ? { ...prev, curX: pos.x, curY: pos.y } : null);
    if (measureDraw) setMeasureDraw((prev) => prev ? { ...prev, curX: pos.x, curY: pos.y } : null);
  }

  function handleBgPointerUp(e: React.PointerEvent<SVGRectElement>) {
    const pos = toMeters(e.clientX, e.clientY);
    if (arrowDraw) {
      const { startX: sx, startY: sy } = arrowDraw;
      if (dist(sx, sy, pos.x, pos.y) > 0.1) {
        dispatch({
          type: "ADD_ARROW",
          arrow: { id: crypto.randomUUID(), startX: sx, startY: sy, endX: pos.x, endY: pos.y, cpX: (sx + pos.x) / 2, cpY: (sy + pos.y) / 2 },
        });
      }
      setArrowDraw(null);
    }
    if (measureDraw) {
      const { startX: sx, startY: sy } = measureDraw;
      if (dist(sx, sy, pos.x, pos.y) > 0.05) {
        onAddMeasurement({ id: crypto.randomUUID(), x1: sx, y1: sy, x2: pos.x, y2: pos.y });
      }
      setMeasureDraw(null);
    }
  }

  function handleConePointerDown(e: React.PointerEvent<SVGElement>, cone: EditableCone) {
    e.stopPropagation();
    if (tool !== "select") return;
    if (e.shiftKey) {
      onSelectCones(selectedConeIds.includes(cone.id)
        ? selectedConeIds.filter((id) => id !== cone.id)
        : [...selectedConeIds, cone.id]);
    } else {
      if (!selectedConeIds.includes(cone.id)) onSelectCones([cone.id]);
    }
    onSelectArrow(null);
    onSelectMeasurement(null);
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
      const scale = Math.min(r.width, r.height) / visibleM;
      const dx = (e.clientX - arrowDragCp.ox) / scale;
      const dy = (e.clientY - arrowDragCp.oy) / scale;
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

  // Too-close pairs
  const tooClosePairs: [EditableCone, EditableCone][] = [];
  for (let i = 0; i < cones.length; i++) {
    for (let j = i + 1; j < cones.length; j++) {
      if (dist(cones[i].x, cones[i].y, cones[j].x, cones[j].y) < PYLON_SPACING) {
        tooClosePairs.push([cones[i], cones[j]]);
      }
    }
  }

  // Grid
  const gridLines: React.ReactNode[] = [];
  for (let i = 0; i <= visibleM; i++) {
    const p = i * S;
    const isMajor = i % 5 === 0;
    gridLines.push(<line key={`h${i}`} x1={0} y1={p} x2={CANVAS_PX} y2={p} stroke={isMajor ? "#d1d5db" : GRID_COLOR} strokeWidth={isMajor ? 1.5 : 1} />);
    gridLines.push(<line key={`v${i}`} x1={p} y1={0} x2={p} y2={CANVAS_PX} stroke={isMajor ? "#d1d5db" : GRID_COLOR} strokeWidth={isMajor ? 1.5 : 1} />);
    if (isMajor && i > 0) {
      gridLines.push(<text key={`l${i}`} x={4} y={p - 3} fontSize={Math.max(8, S * 0.15)} fill="#9ca3af">{i} m</text>);
    }
  }

  // Measurement line rendering helper
  function renderMeasurement(m: MeasurementLine, preview?: boolean) {
    const x1s = m.x1 * S, y1s = m.y1 * S, x2s = m.x2 * S, y2s = m.y2 * S;
    const dxs = x2s - x1s, dys = y2s - y1s;
    const lens = Math.sqrt(dxs ** 2 + dys ** 2);
    if (lens < 1) return null;
    const d = dist(m.x1, m.y1, m.x2, m.y2);
    const sel = !preview && m.id === selectedMeasurementId;
    const color = sel ? "#1d4ed8" : preview ? "#60a5fa" : "#3b82f6";
    const strokeW = sel ? 2.5 : 1.5;
    const tickLen = 10;
    const px = -dys / lens * tickLen, py = dxs / lens * tickLen;
    // Label: offset perpendicular toward top of screen
    const midX = (x1s + x2s) / 2, midY = (y1s + y2s) / 2;
    let nx = -dys / lens, ny = dxs / lens;
    if (ny > 0) { nx = -nx; ny = -ny; }
    const labelOffset = Math.max(10, S * 0.2);
    const labelX = midX + nx * labelOffset;
    const labelY = midY + ny * labelOffset;
    const fontSize = Math.max(9, S * 0.18);

    return (
      <g
        key={m.id}
        onClick={preview ? undefined : (e) => { e.stopPropagation(); onSelectMeasurement(sel ? null : m.id); }}
        style={{ cursor: preview ? "crosshair" : "pointer" }}
        pointerEvents={preview ? "none" : "auto"}
      >
        {/* Wider transparent hit area */}
        {!preview && <line x1={x1s} y1={y1s} x2={x2s} y2={y2s} stroke="transparent" strokeWidth={14} />}
        {/* Main line */}
        <line x1={x1s} y1={y1s} x2={x2s} y2={y2s} stroke={color} strokeWidth={strokeW} strokeDasharray={preview ? "4 3" : undefined} />
        {/* End ticks */}
        <line x1={x1s - px / 2} y1={y1s - py / 2} x2={x1s + px / 2} y2={y1s + py / 2} stroke={color} strokeWidth={strokeW} />
        <line x1={x2s - px / 2} y1={y2s - py / 2} x2={x2s + px / 2} y2={y2s + py / 2} stroke={color} strokeWidth={strokeW} />
        {/* Distance label */}
        <text x={labelX} y={labelY} textAnchor="middle" fontSize={fontSize} fill={color} fontWeight="600">
          {d.toFixed(2)} m{sel ? "  ✕ Entf" : ""}
        </text>
      </g>
    );
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

      {/* Too-close warning lines */}
      {tooClosePairs.map(([a, b], i) => (
        <line key={`tc${i}`}
          x1={a.x * S} y1={a.y * S} x2={b.x * S} y2={b.y * S}
          stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 3" strokeLinecap="round" pointerEvents="none"
        />
      ))}

      {/* Measurement lines */}
      {measurements.map((m) => renderMeasurement(m))}

      {/* Measurement preview while drawing */}
      {measureDraw && renderMeasurement(
        { id: "_preview", x1: measureDraw.startX, y1: measureDraw.startY, x2: measureDraw.curX, y2: measureDraw.curY },
        true
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
              <circle cx={a.cpX * S} cy={a.cpY * S} r={6}
                fill="#2563eb" stroke="white" strokeWidth={1.5} style={{ cursor: "grab" }}
                onPointerDown={(e) => handleCpPointerDown(e, a)}
              />
            )}
          </g>
        );
      })}

      {/* Arrow draw preview */}
      {arrowDraw && (
        <line
          x1={arrowDraw.startX * S} y1={arrowDraw.startY * S}
          x2={arrowDraw.curX * S} y2={arrowDraw.curY * S}
          stroke="#2563eb" strokeWidth={1.5} strokeDasharray="4 3" pointerEvents="none"
        />
      )}

      {/* Cones */}
      {cones.map((cone) => {
        const cx = cone.x * S, cy = cone.y * S;
        const sel = selectedConeIds.includes(cone.id);
        const fill = CONE_COLORS[cone.kind];
        const stroke = sel ? "#2563eb" : "white";
        const sw = sel ? 2.5 : 1.5;

        if (cone.kind === "lying") {
          const w = PYLON_FOOT_SIZE * S * 0.6;
          const h = PYLON_FOOT_SIZE * S * 1.8;
          const angle = cone.angleDeg ?? 0;
          const tri = Math.max(3, h * 0.25);
          return (
            <g key={cone.id} transform={`rotate(${angle}, ${cx}, ${cy})`}
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
            <circle key={cone.id} cx={cx} cy={cy} r={coneR}
              fill="transparent" stroke={sel ? "#2563eb" : "#3b82f6"}
              strokeWidth={sw} strokeDasharray="4 2"
              style={{ cursor: tool === "select" ? "move" : "crosshair" }}
              onPointerDown={(e) => handleConePointerDown(e, cone)}
            />
          );
        }

        return (
          <circle key={cone.id} cx={cx} cy={cy} r={coneR}
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
