// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import React, { useMemo, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Check, X, Pentagon, Square, RotateCcw, RotateCw } from "lucide-react";
import { lngToGlobalX, latToGlobalY, globalXToLng, globalYToLat } from "../lib/geo";
import { polygonToAreaSelection, selectionCorners } from "../lib/areaSelection";
import type { AreaSelection } from "../lib/areaSelection";
import { MAP_PROVIDERS } from "../lib/mapProviders";

const VP_W = 900;
const VP_H = 560;
const TILE_SIZE = 256; // Standard-Kachelgröße von XYZ-Tile-Servern (z.B. OSM)
const SNAP_PX = 14; // Fangradius (Viewport-Pixel) um den ersten Polygonpunkt zum Schliessen per Klick

type Props = {
  initialLat?: number;
  initialLng?: number;
  initialZoom?: number;
  initialSelection?: AreaSelection;
  onSelect: (sel: AreaSelection) => void;
  onCancel: () => void;
};

type LatLng = { lat: number; lng: number };
type VP = { x: number; y: number };

const COMPASS = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
function compassLabel(deg: number) {
  return `${deg}° (${COMPASS[Math.round(deg / 45) % 8]} oben)`;
}

export default function MapSelector({
  initialLat = 50.517,
  initialLng = 7.317,
  initialZoom = 17,
  initialSelection,
  onSelect,
  onCancel,
}: Props) {
  const [zoom, setZoom] = useState(initialZoom);
  const [centerLat, setCenterLat] = useState(initialLat);
  const [centerLng, setCenterLng] = useState(initialLng);

  const [drawMode, setDrawMode] = useState<"none" | "rect" | "poly">("none");
  const [drawnPts, setDrawnPts] = useState<LatLng[]>(() =>
    initialSelection ? selectionCorners(initialSelection) : []
  );
  const [closed, setClosed] = useState(() => !!initialSelection);
  const [liveVP, setLiveVP] = useState<VP | null>(null);
  const [rectStart, setRectStart] = useState<VP | null>(null);
  const [rectLive, setRectLive] = useState<VP | null>(null);
  const [rotationDeg, setRotationDeg] = useState(() => initialSelection?.rotationDeg ?? 0);

  const containerRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ startGx: number; startGy: number; mx: number; my: number } | null>(null);
  const tapRef = useRef<{ mx: number; my: number; t: number } | null>(null);
  const dragHandleRef = useRef<number | null>(null);

  const HANDLE_R = 9; // Radius der Eckpunkt-Ziehgriffe (Hit-Test unten toleriert zusätzlich +5px)

  // Map geometry
  // "Global pixel"-Koordinaten (Web-Mercator-Pixelraum bei aktuellem Zoom, siehe lib/geo.ts) —
  // darüber lassen sich Kartenmittelpunkt, Viewport-Ausschnitt und Kachel-Indizes einheitlich
  // in derselben linearen Einheit verrechnen, unabhängig von der Nichtlinearität von Lat/Lng.
  const cgx = lngToGlobalX(centerLng, zoom);
  const cgy = latToGlobalY(centerLat, zoom);
  const topLeftGx = cgx - VP_W / 2;
  const topLeftGy = cgy - VP_H / 2;
  const n = Math.pow(2, zoom); // Anzahl Kacheln pro Achse bei diesem Zoom (2^zoom, Standard-XYZ-Schema)

  const tileMinX = Math.floor(topLeftGx / TILE_SIZE);
  const tileMinY = Math.floor(topLeftGy / TILE_SIZE);
  const tileMaxX = Math.floor((topLeftGx + VP_W) / TILE_SIZE);
  const tileMaxY = Math.floor((topLeftGy + VP_H) / TILE_SIZE);

  function getVP(e: React.PointerEvent | React.WheelEvent): VP {
    const r = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // Viewport-Pixel (relativ zur Container-Ecke) -> Lat/Lng, über den globalen
  // Pixelraum als Zwischenschritt (topLeftGx/Gy = obere linke Ecke des Viewports darin).
  function vpToLatLng(vx: number, vy: number): LatLng {
    return { lat: globalYToLat(topLeftGy + vy, zoom), lng: globalXToLng(topLeftGx + vx, zoom) };
  }

  // Umkehrung von vpToLatLng — wird für alle SVG-Overlay-Positionen (Punkte, Handles,
  // Bounding-Box) gebraucht, da die Auswahl in Lat/Lng gespeichert ist, aber in
  // Viewport-Pixeln gezeichnet werden muss.
  function latLngToVP(lat: number, lng: number): VP {
    return { x: lngToGlobalX(lng, zoom) - topLeftGx, y: latToGlobalY(lat, zoom) - topLeftGy };
  }

  // Pending selection (recomputed whenever points or rotation changes)
  const pendingSelection = useMemo<AreaSelection | null>(() => {
    if (closed && drawnPts.length >= 3) return polygonToAreaSelection(drawnPts, rotationDeg);
    return null;
  }, [drawnPts, closed, rotationDeg]);

  // Corners of bounding rect in VP pixels (for SVG display)
  const boundingCornerVPs = useMemo<VP[] | null>(() => {
    if (!pendingSelection) return null;
    return selectionCorners(pendingSelection).map((p) => latLngToVP(p.lat, p.lng));
  }, [pendingSelection, zoom, centerLat, centerLng]);

  // ---------- pointer handlers ----------
  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    const vp = getVP(e);
    tapRef.current = { mx: e.clientX, my: e.clientY, t: Date.now() };

    if (drawMode === "rect") {
      setRectStart(vp);
      setRectLive(vp);
    } else {
      // Hit-test corner handles when a closed selection exists
      if (closed && drawnPts.length >= 3 && drawMode === "none") {
        for (let i = 0; i < drawnPts.length; i++) {
          const hVP = latLngToVP(drawnPts[i].lat, drawnPts[i].lng);
          if (Math.hypot(vp.x - hVP.x, vp.y - hVP.y) < HANDLE_R + 5) {
            dragHandleRef.current = i;
            tapRef.current = null;
            return;
          }
        }
      }
      panRef.current = { startGx: cgx, startGy: cgy, mx: e.clientX, my: e.clientY };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const vp = getVP(e);
    if (dragHandleRef.current !== null) {
      const idx = dragHandleRef.current;
      setDrawnPts((prev) => prev.map((p, i) => i === idx ? vpToLatLng(vp.x, vp.y) : p));
      return;
    }
    if (drawMode === "rect" && rectStart) {
      setRectLive(vp);
    } else if (drawMode === "poly") {
      setLiveVP(vp);
      if (panRef.current) {
        const dx = e.clientX - panRef.current.mx;
        const dy = e.clientY - panRef.current.my;
        setCenterLng(globalXToLng(panRef.current.startGx - dx, zoom));
        setCenterLat(globalYToLat(panRef.current.startGy - dy, zoom));
      }
    } else if (panRef.current) {
      const dx = e.clientX - panRef.current.mx;
      const dy = e.clientY - panRef.current.my;
      setCenterLng(globalXToLng(panRef.current.startGx - dx, zoom));
      setCenterLat(globalYToLat(panRef.current.startGy - dy, zoom));
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (dragHandleRef.current !== null) {
      dragHandleRef.current = null;
      tapRef.current = null;
      panRef.current = null;
      return;
    }
    const vp = getVP(e);
    // Ein "Tap" (Punkt setzen) liegt nur vor, wenn Pointer-Down/Up nah beieinander UND
    // schnell hintereinander liegen — sonst würde jedes Ziehen zum Verschieben der Karte
    // (im Polygon-Modus gleichzeitig auch Pan, siehe onPointerMove) fälschlich einen
    // zusätzlichen Polygonpunkt setzen.
    const isTap =
      tapRef.current !== null &&
      Math.hypot(e.clientX - tapRef.current.mx, e.clientY - tapRef.current.my) < 5 &&
      Date.now() - tapRef.current.t < 250;
    tapRef.current = null;

    if (drawMode === "rect" && rectStart) {
      const w = Math.abs(vp.x - rectStart.x);
      const h = Math.abs(vp.y - rectStart.y);
      if (w > 10 && h > 10) {
        const x1 = Math.min(rectStart.x, vp.x);
        const y1 = Math.min(rectStart.y, vp.y);
        const x2 = Math.max(rectStart.x, vp.x);
        const y2 = Math.max(rectStart.y, vp.y);
        const corners = [vpToLatLng(x1, y1), vpToLatLng(x2, y1), vpToLatLng(x2, y2), vpToLatLng(x1, y2)];
        setDrawnPts(corners);
        setClosed(true);
        setDrawMode("none");
      }
      setRectStart(null);
      setRectLive(null);
    } else if (drawMode === "poly" && isTap) {
      // Snap to first point?
      if (drawnPts.length >= 3) {
        const firstVP = latLngToVP(drawnPts[0].lat, drawnPts[0].lng);
        if (Math.hypot(vp.x - firstVP.x, vp.y - firstVP.y) < SNAP_PX) {
          setClosed(true);
          setDrawMode("none");
          panRef.current = null;
          return;
        }
      }
      setDrawnPts((prev) => [...prev, vpToLatLng(vp.x, vp.y)]);
    }
    panRef.current = null;
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const vp = getVP(e);
    // Zoom-um-Cursor: erst die Lat/Lng unter dem Mauszeiger im alten Zoom merken, nach dem
    // Zoomwechsel den neuen Kartenmittelpunkt so verschieben, dass genau dieser Punkt wieder
    // unter dem Cursor liegt — sonst würde jeder Zoom die Karte spürbar "wegspringen" lassen.
    const latUnder = globalYToLat(topLeftGy + vp.y, zoom);
    const lngUnder = globalXToLng(topLeftGx + vp.x, zoom);
    const newZoom = Math.min(19, Math.max(1, zoom + (e.deltaY < 0 ? 1 : -1))); // 19 = übliches Max-Zoom vieler XYZ-Anbieter (u.a. OSM)
    const newCgx = lngToGlobalX(lngUnder, newZoom) - vp.x + VP_W / 2;
    const newCgy = latToGlobalY(latUnder, newZoom) - vp.y + VP_H / 2;
    setZoom(newZoom);
    setCenterLng(globalXToLng(newCgx, newZoom));
    setCenterLat(globalYToLat(newCgy, newZoom));
  }

  function startMode(mode: "rect" | "poly") {
    setDrawnPts([]);
    setClosed(false);
    setRectStart(null);
    setRectLive(null);
    setLiveVP(null);
    setDrawMode(mode);
  }

  function resetAll() {
    setDrawnPts([]);
    setClosed(false);
    setRectStart(null);
    setRectLive(null);
    setLiveVP(null);
    setDrawMode("none");
  }

  // ---------- SVG helpers ----------
  const polyPointsStr = drawnPts.map((p) => {
    const vp = latLngToVP(p.lat, p.lng);
    return `${vp.x},${vp.y}`;
  }).join(" ");

  const lastPt = drawnPts.length > 0 ? latLngToVP(drawnPts[drawnPts.length - 1].lat, drawnPts[drawnPts.length - 1].lng) : null;
  const firstPt = drawnPts.length > 0 ? latLngToVP(drawnPts[0].lat, drawnPts[0].lng) : null;

  const rectDisplayX = rectStart && rectLive ? Math.min(rectStart.x, rectLive.x) : 0;
  const rectDisplayY = rectStart && rectLive ? Math.min(rectStart.y, rectLive.y) : 0;
  const rectDisplayW = rectStart && rectLive ? Math.abs(rectLive.x - rectStart.x) : 0;
  const rectDisplayH = rectStart && rectLive ? Math.abs(rectLive.y - rectStart.y) : 0;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => setZoom((z) => Math.min(19, z + 1))} style={btnStyle}>
          <ZoomIn size={14} /> +
        </button>
        <button onClick={() => setZoom((z) => Math.max(1, z - 1))} style={btnStyle}>
          <ZoomOut size={14} /> −
        </button>
        <span style={{ fontSize: 11, color: "#64748b" }}>Z{zoom}</span>

        <div style={{ width: 1, height: 20, background: "#e2e8f0" }} />

        <button
          onClick={() => startMode("rect")}
          style={{ ...btnStyle, ...(drawMode === "rect" ? activeBtnStyle : {}) }}
        >
          <Square size={14} /> Rechteck
        </button>
        <button
          onClick={() => startMode("poly")}
          style={{ ...btnStyle, ...(drawMode === "poly" ? activeBtnStyle : {}) }}
        >
          <Pentagon size={14} /> Polygon
        </button>
        {drawMode === "poly" && drawnPts.length >= 3 && (
          <button
            onClick={() => { setClosed(true); setDrawMode("none"); }}
            style={{ ...btnStyle, borderColor: "var(--c-primary)", color: "var(--c-primary)", fontWeight: 700 }}
          >
            Polygon schliessen
          </button>
        )}
        {(drawnPts.length > 0 || closed) && (
          <button onClick={resetAll} style={{ ...btnStyle, color: "#64748b" }}>
            <X size={14} /> Zuruecksetzen
          </button>
        )}

        <div style={{ flex: 1 }} />

        {pendingSelection && (
          <button onClick={() => onSelect(pendingSelection)} style={confirmBtnStyle}>
            <Check size={15} />
            {pendingSelection.widthM.toFixed(0)} m × {pendingSelection.heightM.toFixed(0)} m uebernehmen
          </button>
        )}
        <button onClick={onCancel} style={{ ...btnStyle, color: "#64748b" }}>
          <X size={14} /> Abbrechen
        </button>
      </div>

      {/* Mode hint */}
      {drawMode === "rect" && (
        <div style={{ fontSize: 12, color: "var(--c-primary)", marginBottom: 6 }}>
          Klicken und ziehen um ein Rechteck aufzuziehen.
        </div>
      )}
      {drawMode === "poly" && (
        <div style={{ fontSize: 12, color: "var(--c-primary)", marginBottom: 6 }}>
          Klicken um Punkte zu setzen. {drawnPts.length >= 3 ? 'Ersten Punkt erneut anklicken oder "Polygon schliessen".' : `Noch ${3 - drawnPts.length} Punkt(e) bis zum Schliessen.`}
        </div>
      )}

      {/* Rotation control */}
      {(pendingSelection || closed) && drawnPts.length >= 3 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "6px 10px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
          <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>Drehung:</span>
          <button onClick={() => setRotationDeg((d) => (d - 15 + 360) % 360)} style={smallBtnStyle}>
            <RotateCcw size={13} /> −15°
          </button>
          <input
            type="range" min={0} max={359} step={1}
            value={rotationDeg}
            onChange={(e) => setRotationDeg(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <button onClick={() => setRotationDeg((d) => (d + 15) % 360)} style={smallBtnStyle}>
            <RotateCw size={13} /> +15°
          </button>
          <span style={{ fontSize: 12, color: "#475569", whiteSpace: "nowrap", minWidth: 80 }}>
            {compassLabel(rotationDeg)}
          </span>
        </div>
      )}

      {/* Map viewport */}
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        style={{
          position: "relative",
          width: VP_W, height: VP_H,
          overflow: "hidden",
          cursor: drawMode === "rect" ? "crosshair" : drawMode === "poly" ? "crosshair" : "grab",
          border: "1px solid #cbd5e1",
          borderRadius: 16,
          userSelect: "none",
          touchAction: "none",
          background: "#e2e8f0",
        }}
      >
        {/* Tiles */}
        {Array.from({ length: tileMaxY - tileMinY + 1 }, (_, yi) =>
          Array.from({ length: tileMaxX - tileMinX + 1 }, (_, xi) => {
            const tx = tileMinX + xi;
            const ty = tileMinY + yi;
            // X-Kachelindex modulo Kachelanzahl (mit Korrektur für negative tx via +n):
            // erlaubt Panning über die 180°-Meridian-Grenze hinweg, ohne dass Kacheln fehlen.
            const wrappedTx = ((tx % n) + n) % n;
            return (
              <img
                key={`${tx}-${ty}`}
                src={MAP_PROVIDERS.osm.xyzTileUrl!(zoom, wrappedTx, ty)}
                alt="" draggable={false}
                style={{
                  position: "absolute",
                  left: tx * TILE_SIZE - topLeftGx,
                  top: ty * TILE_SIZE - topLeftGy,
                  width: TILE_SIZE, height: TILE_SIZE,
                }}
              />
            );
          })
        )}

        {/* SVG overlay */}
        <svg
          style={{ position: "absolute", inset: 0, width: VP_W, height: VP_H, pointerEvents: "none", overflow: "visible" }}
        >
          {/* Live rectangle while dragging */}
          {drawMode === "rect" && rectStart && rectLive && rectDisplayW > 0 && rectDisplayH > 0 && (
            <rect
              x={rectDisplayX} y={rectDisplayY}
              width={rectDisplayW} height={rectDisplayH}
              fill="rgba(59,130,246,0.12)"
              stroke="#3b82f6" strokeWidth={2}
            />
          )}

          {/* Polygon in progress */}
          {drawnPts.length >= 2 && !closed && (
            <polyline points={polyPointsStr} fill="none" stroke="#3b82f6" strokeWidth={2} />
          )}
          {closed && drawnPts.length >= 3 && (
            <polygon points={polyPointsStr} fill="rgba(59,130,246,0.12)" stroke="#3b82f6" strokeWidth={2} />
          )}
          {/* Live preview line to cursor */}
          {drawMode === "poly" && lastPt && liveVP && (
            <line
              x1={lastPt.x} y1={lastPt.y}
              x2={liveVP.x} y2={liveVP.y}
              stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="5 4"
            />
          )}
          {/* Vertex dots */}
          {!closed && drawnPts.map((p, i) => {
            const vp = latLngToVP(p.lat, p.lng);
            const isFirst = i === 0;
            return (
              <circle
                key={i} cx={vp.x} cy={vp.y}
                r={isFirst && drawnPts.length >= 3 ? 7 : 5}
                fill={isFirst && drawnPts.length >= 3 ? "#3b82f6" : "white"}
                stroke="#3b82f6" strokeWidth={2}
              />
            );
          })}

          {/* Rotated bounding rectangle */}
          {boundingCornerVPs && (
            <polygon
              points={boundingCornerVPs.map((vp) => `${vp.x},${vp.y}`).join(" ")}
              fill="rgba(245,158,11,0.1)"
              stroke="#f59e0b" strokeWidth={2}
              strokeDasharray="7 3"
            />
          )}

          {/* Draggable corner handles for closed selection */}
          {closed && drawnPts.map((p, i) => {
            const vp = latLngToVP(p.lat, p.lng);
            return (
              <circle
                key={`handle-${i}`} cx={vp.x} cy={vp.y} r={HANDLE_R}
                fill="white" stroke="#3b82f6" strokeWidth={2.5}
              />
            );
          })}

          {/* Dimensions label */}
          {pendingSelection && (() => {
            const c = latLngToVP(pendingSelection.centerLat, pendingSelection.centerLng);
            return (
              <text
                x={c.x} y={c.y}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={13} fontWeight={700} fill="#0f172a"
                stroke="white" strokeWidth={3} paintOrder="stroke"
              >
                {pendingSelection.widthM.toFixed(1)} m × {pendingSelection.heightM.toFixed(1)} m
              </text>
            );
          })()}

          {/* Snap ring on first polygon point */}
          {drawMode === "poly" && drawnPts.length >= 3 && firstPt && (
            <circle cx={firstPt.x} cy={firstPt.y} r={SNAP_PX} fill="none" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 2" opacity={0.6} />
          )}
        </svg>

        {/* Attribution */}
        <div style={{
          position: "absolute", bottom: 4, right: 6, fontSize: 9,
          color: "rgba(0,0,0,0.6)", background: "rgba(255,255,255,0.75)",
          padding: "1px 5px", borderRadius: 3, pointerEvents: "none",
        }}>
          © OpenStreetMap contributors
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  borderRadius: 9, border: "1px solid #cbd5e1",
  background: "white", padding: "6px 11px", cursor: "pointer", fontSize: 13,
};
const activeBtnStyle: React.CSSProperties = {
  border: "2px solid var(--c-primary)", background: "var(--c-primary-bg)", color: "var(--c-primary)", fontWeight: 700,
};
const confirmBtnStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  borderRadius: 9, border: "2px solid var(--c-primary)",
  background: "var(--c-primary)", color: "white",
  padding: "6px 13px", cursor: "pointer", fontSize: 13, fontWeight: 700,
};
const smallBtnStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4,
  borderRadius: 7, border: "1px solid #cbd5e1",
  background: "white", padding: "4px 8px", cursor: "pointer", fontSize: 12,
};
