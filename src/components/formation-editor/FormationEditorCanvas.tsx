// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useRef, useState } from "react";
import type { PlacedArrow } from "../../types";
import type { EditableCone, EditorAction } from "../../hooks/useFormationEditor";
import { PYLON_FOOT_SIZE, PYLON_HEIGHT, PYLON_SPACING } from "../../lib/formations/common";
import {
  dist,
  applySnap as applySnapUtil,
  computeLinePylons as computeLinePylonsUtil,
  type SnapIndicator,
} from "../../lib/formations/formationEditorUtils";

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
  onGatePairClick: (coneId: string) => void;
};

export default function FormationEditorCanvas({
  cones, arrows, measurements,
  selectedConeIds, selectedArrowId, selectedMeasurementId,
  tool, visibleM, dispatch,
  onSelectCones, onSelectArrow, onSelectMeasurement, onAddMeasurement,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: string } | null>(null);
  const [arrowDraw, setArrowDraw] = useState<LineDraw | null>(null);
  const [measureDraw, setMeasureDraw] = useState<LineDraw | null>(null);
  const [arrowDragCp, setArrowDragCp] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const [rotDrag, setRotDrag] = useState<{ id: string } | null>(null);
  const [snapIndicator, setSnapIndicator] = useState<SnapIndicator | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [pylonLine, setPylonLine] = useState<LineDraw | null>(null);

  const S = CANVAS_PX / visibleM;

  /** Screen coords → meters, accounting for letterbox when SVG DOM ≠ square */
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

  /** Screen coords → SVG internal coords (0‥CANVAS_PX) */
  function toSvgCoords(clientX: number, clientY: number) {
    const r = svgRef.current!.getBoundingClientRect();
    const size = Math.min(r.width, r.height);
    const ox = (r.width - size) / 2;
    const oy = (r.height - size) / 2;
    return {
      x: ((clientX - r.left - ox) / size) * CANVAS_PX,
      y: ((clientY - r.top - oy) / size) * CANVAS_PX,
    };
  }

  function applySnap(mx: number, my: number, movingId: string) {
    return applySnapUtil(mx, my, movingId, cones);
  }

  function computeLinePylons(sx: number, sy: number, ex: number, ey: number) {
    return computeLinePylonsUtil(sx, sy, ex, ey);
  }

  function handleBgPointerDown(e: React.PointerEvent<SVGRectElement>) {
    const pos = toMeters(e.clientX, e.clientY);
    if (tool === "standing" || tool === "lying" || tool === "sensor") {
      if (e.shiftKey) {
        setPylonLine({ startX: pos.x, startY: pos.y, curX: pos.x, curY: pos.y });
        (e.target as SVGElement).setPointerCapture(e.pointerId);
      } else {
        // Kein Snap beim Platzieren — Cone landet exakt wo geklickt wurde
        dispatch({ type: "ADD_CONE", cone: { id: crypto.randomUUID(), x: pos.x, y: pos.y, kind: tool } });
      }
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
    if (arrowDraw) setArrowDraw((p) => p ? { ...p, curX: pos.x, curY: pos.y } : null);
    if (measureDraw) setMeasureDraw((p) => p ? { ...p, curX: pos.x, curY: pos.y } : null);
    if (pylonLine) setPylonLine((p) => p ? { ...p, curX: pos.x, curY: pos.y } : null);
  }

  function handleBgPointerUp(e: React.PointerEvent<SVGRectElement>) {
    const pos = toMeters(e.clientX, e.clientY);
    if (pylonLine) {
      const positions = computeLinePylons(pylonLine.startX, pylonLine.startY, pos.x, pos.y);
      const kind = tool as "standing" | "lying" | "sensor";
      positions.forEach(({ x, y, angleDeg }) => {
        dispatch({
          type: "ADD_CONE",
          cone: {
            id: crypto.randomUUID(), x, y, kind,
            ...(kind === "lying" ? { angleDeg } : {}),
          },
        });
      });
      setPylonLine(null);
      return;
    }
    if (arrowDraw) {
      const { startX: sx, startY: sy } = arrowDraw;
      if (dist(sx, sy, pos.x, pos.y) > 0.1) {
        dispatch({ type: "ADD_ARROW", arrow: { id: crypto.randomUUID(), startX: sx, startY: sy, endX: pos.x, endY: pos.y, cpX: (sx + pos.x) / 2, cpY: (sy + pos.y) / 2 } });
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
    dragRef.current = { id: cone.id };
    // Use currentTarget (the <g> or <circle> with the handler), not target (inner child element)
    (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
  }

  function handleSvgPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (tool === "standing" || tool === "lying" || tool === "sensor") {
      // Kein Snap in Platzierungs-Modus — cursor folgt exakt dem Zeiger
      const raw = toMeters(e.clientX, e.clientY);
      setCursorPos(raw);
      if (!dragRef.current) setSnapIndicator(null);
    }
    if (dragRef.current) {
      const raw = toMeters(e.clientX, e.clientY);
      const { x, y, indicator } = applySnap(raw.x, raw.y, dragRef.current.id);
      dispatch({ type: "MOVE_CONE", id: dragRef.current.id, x, y });
      setSnapIndicator(indicator);
    }
    if (arrowDragCp) {
      const r = svgRef.current!.getBoundingClientRect();
      const scale = Math.min(r.width, r.height) / visibleM;
      dispatch({ type: "MOVE_ARROW_CP", id: arrowDragCp.id, dx: (e.clientX - arrowDragCp.ox) / scale, dy: (e.clientY - arrowDragCp.oy) / scale });
      setArrowDragCp({ ...arrowDragCp, ox: e.clientX, oy: e.clientY });
    }
    if (rotDrag) {
      const svgPos = toSvgCoords(e.clientX, e.clientY);
      const cone = cones.find((c) => c.id === rotDrag.id);
      if (cone) {
        const cx = cone.x * S, cy = cone.y * S;
        const angle = Math.atan2(svgPos.x - cx, cy - svgPos.y) * 180 / Math.PI;
        dispatch({ type: "UPDATE_CONE", id: rotDrag.id, patch: { angleDeg: Math.round(((angle % 360) + 360) % 360) } });
      }
    }
  }

  function handleSvgPointerUp() {
    dragRef.current = null;
    setArrowDragCp(null);
    setRotDrag(null);
    setSnapIndicator(null);
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
    const major = i % 5 === 0;
    gridLines.push(<line key={`h${i}`} x1={0} y1={p} x2={CANVAS_PX} y2={p} stroke={major ? "#d1d5db" : GRID_COLOR} strokeWidth={major ? 1.5 : 1} />);
    gridLines.push(<line key={`v${i}`} x1={p} y1={0} x2={p} y2={CANVAS_PX} stroke={major ? "#d1d5db" : GRID_COLOR} strokeWidth={major ? 1.5 : 1} />);
    if (major && i > 0) gridLines.push(<text key={`l${i}`} x={4} y={p - 3} fontSize={Math.max(8, S * 0.15)} fill="#9ca3af">{i} m</text>);
  }

  // Measurement line helper
  function renderMeasurement(m: MeasurementLine, preview?: boolean) {
    const x1s = m.x1 * S, y1s = m.y1 * S, x2s = m.x2 * S, y2s = m.y2 * S;
    const dxs = x2s - x1s, dys = y2s - y1s;
    const lens = Math.sqrt(dxs ** 2 + dys ** 2);
    if (lens < 1) return null;
    const d = dist(m.x1, m.y1, m.x2, m.y2);
    const sel = !preview && m.id === selectedMeasurementId;
    const color = sel ? "#1d4ed8" : preview ? "#60a5fa" : "#3b82f6";
    const sw = sel ? 2.5 : 1.5;
    const tickLen = 10;
    const px = -dys / lens * tickLen, py = dxs / lens * tickLen;
    const midX = (x1s + x2s) / 2, midY = (y1s + y2s) / 2;
    let nx = -dys / lens, ny = dxs / lens;
    if (ny > 0) { nx = -nx; ny = -ny; }
    const lo = Math.max(10, S * 0.2);
    const fs = Math.max(9, S * 0.18);
    return (
      <g key={m.id} onClick={preview ? undefined : (e) => { e.stopPropagation(); onSelectMeasurement(sel ? null : m.id); }}
        style={{ cursor: preview ? "crosshair" : "pointer" }} pointerEvents={preview ? "none" : "auto"}>
        {!preview && <line x1={x1s} y1={y1s} x2={x2s} y2={y2s} stroke="transparent" strokeWidth={14} />}
        <line x1={x1s} y1={y1s} x2={x2s} y2={y2s} stroke={color} strokeWidth={sw} strokeDasharray={preview ? "4 3" : undefined} />
        <line x1={x1s - px / 2} y1={y1s - py / 2} x2={x1s + px / 2} y2={y1s + py / 2} stroke={color} strokeWidth={sw} />
        <line x1={x2s - px / 2} y1={y2s - py / 2} x2={x2s + px / 2} y2={y2s + py / 2} stroke={color} strokeWidth={sw} />
        <text x={midX + nx * lo} y={midY + ny * lo} textAnchor="middle" fontSize={fs} fill={color} fontWeight="600">
          {d.toFixed(2)} m{sel ? "  ✕ Entf" : ""}
        </text>
      </g>
    );
  }

  // Rotation handle for selected lying cone
  // Rotation handle for selected standing or lying cone
  const selectedRotCone = selectedConeIds.length === 1
    ? (cones.find((c) => c.id === selectedConeIds[0] && (c.kind === "lying" || c.kind === "standing")) ?? null)
    : null;

  let rotHandleX = 0, rotHandleY = 0;
  if (selectedRotCone) {
    const cx = selectedRotCone.x * S, cy = selectedRotCone.y * S;
    const halfExtent = selectedRotCone.kind === "lying"
      ? Math.max(8, PYLON_HEIGHT * S) / 2
      : Math.max(4, PYLON_FOOT_SIZE * S) / 2;
    const handleDist = halfExtent + 14;
    const θ = ((selectedRotCone.angleDeg ?? 0) * Math.PI) / 180;
    rotHandleX = cx + handleDist * Math.sin(θ);
    rotHandleY = cy - handleDist * Math.cos(θ);
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${CANVAS_PX} ${CANVAS_PX}`}
      style={{ display: "block", width: "100%", maxHeight: "100%", aspectRatio: "1", cursor: tool === "select" ? "default" : "crosshair", userSelect: "none" }}
      onPointerMove={handleSvgPointerMove}
      onPointerUp={handleSvgPointerUp}
      onPointerLeave={() => setCursorPos(null)}
    >
      <rect width={CANVAS_PX} height={CANVAS_PX} fill={BG_COLOR} />
      {gridLines}
      <rect width={CANVAS_PX} height={CANVAS_PX} fill="transparent"
        onPointerDown={handleBgPointerDown} onPointerMove={handleBgPointerMove} onPointerUp={handleBgPointerUp}
        style={{ cursor: tool === "select" ? "default" : "crosshair" }}
      />

      {/* Too-close warning */}
      {tooClosePairs.map(([a, b], i) => (
        <line key={`tc${i}`} x1={a.x * S} y1={a.y * S} x2={b.x * S} y2={b.y * S}
          stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 3" strokeLinecap="round" pointerEvents="none" />
      ))}

      {/* Snap indicator — shown while Shift+dragging */}
      {snapIndicator && (() => {
        const x1 = snapIndicator.x1 * S, y1 = snapIndicator.y1 * S;
        const x2 = snapIndicator.x2 * S, y2 = snapIndicator.y2 * S;
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const fs = Math.max(10, S * 0.18);
        return (
          <g pointerEvents="none">
            <line x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#10b981" strokeWidth={2} strokeDasharray="5 3" />
            <rect x={mx - fs * 2.2} y={my - fs * 0.9} width={fs * 4.4} height={fs * 1.5}
              fill="white" opacity={0.85} rx={3} />
            <text x={mx} y={my + fs * 0.4} textAnchor="middle" fontSize={fs} fill="#10b981" fontWeight="700">
              ⇧ {snapIndicator.label}
            </text>
          </g>
        );
      })()}

      {/* Measurement lines */}
      {measurements.map((m) => renderMeasurement(m))}
      {measureDraw && renderMeasurement({ id: "_preview", x1: measureDraw.startX, y1: measureDraw.startY, x2: measureDraw.curX, y2: measureDraw.curY }, true)}

      {/* Pylon-line preview (Shift+drag in placement mode) */}
      {pylonLine && (tool === "standing" || tool === "lying" || tool === "sensor") && (() => {
        const positions = computeLinePylons(pylonLine.startX, pylonLine.startY, pylonLine.curX, pylonLine.curY);
        const fill = CONE_COLORS[tool];
        const sq = Math.max(4, PYLON_FOOT_SIZE * S);
        const baseW = Math.max(6, PYLON_FOOT_SIZE * S);
        const tipW  = Math.max(2, 0.05 * S);
        const h     = Math.max(8, PYLON_HEIGHT * S);
        const fs    = Math.max(10, S * 0.18);
        const lastPt = positions[positions.length - 1];
        return (
          <g pointerEvents="none">
            <line
              x1={pylonLine.startX * S} y1={pylonLine.startY * S}
              x2={pylonLine.curX * S}  y2={pylonLine.curY * S}
              stroke={fill} strokeWidth={1} strokeDasharray="4 3" opacity={0.4} />
            {positions.map((p, i) => {
              const cx = p.x * S, cy = p.y * S;
              if (tool === "lying") {
                const pts = [`${cx-tipW/2},${cy-h/2}`,`${cx+tipW/2},${cy-h/2}`,`${cx+baseW/2},${cy+h/2}`,`${cx-baseW/2},${cy+h/2}`].join(" ");
                return <polygon key={i} transform={`rotate(${p.angleDeg},${cx},${cy})`} points={pts} fill={fill} opacity={0.4} />;
              }
              if (tool === "sensor") {
                const sr = Math.max(4, (PYLON_FOOT_SIZE / 2) * S);
                return <circle key={i} cx={cx} cy={cy} r={sr} fill="transparent" stroke={fill} strokeWidth={1.5} strokeDasharray="3 2" opacity={0.5} />;
              }
              return <rect key={i} x={cx-sq/2} y={cy-sq/2} width={sq} height={sq} fill={fill} opacity={0.4} rx={Math.max(2, sq*0.2)} />;
            })}
            <rect x={lastPt.x*S - fs*1.6} y={lastPt.y*S - h/2 - fs*1.8} width={fs*3.2} height={fs*1.4} fill="white" opacity={0.85} rx={3} />
            <text x={lastPt.x*S} y={lastPt.y*S - h/2 - fs*0.6} textAnchor="middle" fontSize={fs} fill={fill} fontWeight="700">
              {positions.length}×
            </text>
          </g>
        );
      })()}

      {/* Ghost pylon preview in placement mode */}
      {!pylonLine && cursorPos && (tool === "standing" || tool === "lying" || tool === "sensor") && (() => {
        const cx = cursorPos.x * S, cy = cursorPos.y * S;
        const fill = CONE_COLORS[tool];
        if (tool === "lying") {
          const baseW = Math.max(6, PYLON_FOOT_SIZE * S);
          const tipW  = Math.max(2, 0.05 * S);
          const h     = Math.max(8, PYLON_HEIGHT * S);
          const pts   = [`${cx - tipW / 2},${cy - h / 2}`, `${cx + tipW / 2},${cy - h / 2}`, `${cx + baseW / 2},${cy + h / 2}`, `${cx - baseW / 2},${cy + h / 2}`].join(" ");
          return <polygon key="ghost" points={pts} fill={fill} opacity={0.35} pointerEvents="none" />;
        }
        if (tool === "sensor") {
          const sr = Math.max(4, (PYLON_FOOT_SIZE / 2) * S);
          return <circle key="ghost" cx={cx} cy={cy} r={sr} fill="transparent" stroke={fill} strokeWidth={1.5} strokeDasharray="4 2" opacity={0.5} pointerEvents="none" />;
        }
        const sq = Math.max(4, PYLON_FOOT_SIZE * S);
        return <rect key="ghost" x={cx - sq / 2} y={cy - sq / 2} width={sq} height={sq} fill={fill} opacity={0.35} rx={Math.max(2, sq * 0.2)} pointerEvents="none" />;
      })()}

      {/* Arrows */}
      {arrows.map((a) => {
        const sel = a.id === selectedArrowId;
        return (
          <g key={a.id} onClick={() => onSelectArrow(a.id)} style={{ cursor: "pointer" }}>
            <path d={`M ${a.startX * S} ${a.startY * S} Q ${a.cpX * S} ${a.cpY * S} ${a.endX * S} ${a.endY * S}`}
              fill="none" stroke={sel ? "#2563eb" : "#334155"} strokeWidth={sel ? 2.5 : 2} markerEnd="url(#arrowhead)" />
            {sel && <circle cx={a.cpX * S} cy={a.cpY * S} r={6} fill="#2563eb" stroke="white" strokeWidth={1.5}
              style={{ cursor: "grab" }} onPointerDown={(e) => handleCpPointerDown(e, a)} />}
          </g>
        );
      })}
      {arrowDraw && <line x1={arrowDraw.startX * S} y1={arrowDraw.startY * S} x2={arrowDraw.curX * S} y2={arrowDraw.curY * S}
        stroke="#2563eb" strokeWidth={1.5} strokeDasharray="4 3" pointerEvents="none" />}

      {/* Cones */}
      {cones.map((cone) => {
        const cx = cone.x * S, cy = cone.y * S;
        const sel = selectedConeIds.includes(cone.id);
        const fill = CONE_COLORS[cone.kind];
        const stroke = sel ? "#2563eb" : "white";
        const sw = sel ? 2.5 : 1.5;

        if (cone.kind === "lying") {
          // Leitkegel lying on its side: trapezoid — 30 cm base, ~5 cm tip, 50 cm long
          const baseW = Math.max(6, PYLON_FOOT_SIZE * S);
          const tipW  = Math.max(2, 0.05 * S);
          const h     = Math.max(8, PYLON_HEIGHT * S);
          const angle = cone.angleDeg ?? 0;
          const pts = [
            `${cx - tipW / 2},${cy - h / 2}`,
            `${cx + tipW / 2},${cy - h / 2}`,
            `${cx + baseW / 2},${cy + h / 2}`,
            `${cx - baseW / 2},${cy + h / 2}`,
          ].join(" ");
          return (
            <g key={cone.id} transform={`rotate(${angle}, ${cx}, ${cy})`}
              style={{ cursor: tool === "select" ? "move" : "crosshair" }}
              onPointerDown={(e) => handleConePointerDown(e, cone)}>
              <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} />
            </g>
          );
        }

        if (cone.kind === "sensor") {
          const sr = Math.max(4, (PYLON_FOOT_SIZE / 2) * S);
          return (
            <circle key={cone.id} cx={cx} cy={cy} r={sr}
              fill="transparent" stroke={sel ? "#2563eb" : "#3b82f6"}
              strokeWidth={sw} strokeDasharray="4 2"
              style={{ cursor: tool === "select" ? "move" : "crosshair" }}
              onPointerDown={(e) => handleConePointerDown(e, cone)} />
          );
        }

        // Standing pylon: square footprint (30 × 30 cm), rotatable
        const sq = Math.max(4, PYLON_FOOT_SIZE * S);
        const angle = cone.angleDeg ?? 0;
        return (
          <g key={cone.id} transform={`rotate(${angle}, ${cx}, ${cy})`}
            style={{ cursor: tool === "select" ? "move" : "crosshair" }}
            onPointerDown={(e) => handleConePointerDown(e, cone)}>
            <rect x={cx - sq / 2} y={cy - sq / 2} width={sq} height={sq}
              fill={fill} stroke={stroke} strokeWidth={sw} rx={Math.max(2, sq * 0.2)} />
          </g>
        );
      })}

      {/* Rotation handle for selected standing or lying cone */}
      {selectedRotCone && (
        <g>
          <line
            x1={selectedRotCone.x * S} y1={selectedRotCone.y * S}
            x2={rotHandleX} y2={rotHandleY}
            stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 2" pointerEvents="none" />
          <circle
            cx={rotHandleX} cy={rotHandleY} r={7}
            fill="#f59e0b" stroke="white" strokeWidth={2}
            style={{ cursor: "grab" }}
            onPointerDown={(e) => {
              e.stopPropagation();
              setRotDrag({ id: selectedRotCone.id });
              (e.target as SVGElement).setPointerCapture(e.pointerId);
            }}
          />
        </g>
      )}

      <defs>
        <marker id="arrowhead" markerWidth={6} markerHeight={4} refX={5} refY={2} orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill="#334155" />
        </marker>
      </defs>
    </svg>
  );
}
