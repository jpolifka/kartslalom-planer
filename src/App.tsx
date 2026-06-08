// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import React, { useMemo, useReducer, useRef, useEffect, useState } from "react";
import {
  RotateCw, Trash2, AlertTriangle, Info, Pencil, Map, Satellite,
  ChevronDown, ChevronRight, MousePointer, Undo2, Redo2, X, FileDown,
  Menu, SlidersHorizontal, HelpCircle,
} from "lucide-react";
import TrackCanvas from "./components/TrackCanvas";
import type { MapConfig } from "./components/TrackCanvas";
import MapSelector from "./components/MapSelector";
import FormationThumbnail from "./components/FormationThumbnail";
import { getFormation, getEffectiveDuration } from "./lib/formationRegistry";
import { runValidation } from "./lib/validation";
import { generateTrackSVG, downloadSVG, printAsPDF } from "./lib/exportSVG";
import type { AreaSelection } from "./lib/areaSelection";
import type { FormationKey, PlacedArrow, PlacedFormation } from "./types";
import { saveState, loadState, clearSavedState, exportAsFile, parseImportFile } from "./lib/storage";

// Load once at startup, shared across all useState lazy initializers
let _initialSaved = loadState();

const MOBILE_BREAKPOINT = 860;

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

// ── Track state + history reducer ───────────────────────────────────
type TrackState = { items: PlacedFormation[]; arrows: PlacedArrow[] };

type TrackAction =
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

type HistState = { past: TrackState[]; present: TrackState; future: TrackState[] };

const INITIAL_TRACK: TrackState = { items: [], arrows: [] };

function trackReducer(s: HistState, action: TrackAction): HistState {
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

// ── Formation groups ─────────────────────────────────────────────────
const FORMATION_GROUPS: Array<{ key: string; label: string; formations: FormationKey[]; rotationSubMenu?: boolean }> = [
  { key: "startziel", label: "Start / Ziel", formations: ["startGate", "finishLane", "vorstartbereich", "wechselzone"] },
  { key: "basis", label: "Basis", formations: ["singlePylon", "turn90to180", "tor", "gasse", "swissSlalom", "switchGate", "sLane"] },
  { key: "kurven", label: "Kurven", formations: ["normalCorner", "normalCornerAlt", "germanCorner", "circle"], rotationSubMenu: true },
  { key: "komplex", label: "Komplex", formations: ["zLane", "boxStraight", "boxTurn", "snail", "cross", "pretzel", "chicane", "ypsilon"] },
];

// ── App ──────────────────────────────────────────────────────────────
export default function App() {
  // Area / map
  const [areaSel, setAreaSel] = useState<AreaSelection | null>(() => _initialSaved?.areaSel ?? null);
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [manualWidth, setManualWidth] = useState(() => _initialSaved?.manualWidth ?? 18);
  const [manualLength, setManualLength] = useState(() => _initialSaved?.manualLength ?? 36);
  const [manualWidthInput, setManualWidthInput] = useState(() => String(_initialSaved?.manualWidth ?? 18));
  const [manualLengthInput, setManualLengthInput] = useState(() => String(_initialSaved?.manualLength ?? 36));
  const [mapSatellite, setMapSatellite] = useState(() => _initialSaved?.mapSatellite ?? true);
  const [mapOpacity, setMapOpacity] = useState(() => _initialSaved?.mapOpacity ?? 0.5);

  const fieldWidth = areaSel ? areaSel.widthM : manualWidth;
  const fieldLength = areaSel ? areaSel.heightM : manualLength;
  const mapConfig: MapConfig | null = areaSel
    ? { selection: areaSel, satellite: mapSatellite, opacity: mapOpacity }
    : null;

  // Track + history — restored from storage on first load
  const [hist, dispatch] = useReducer(
    trackReducer,
    null,
    (_: null): HistState => ({
      past: [],
      present: _initialSaved
        ? { items: _initialSaved.items, arrows: _initialSaved.arrows }
        : INITIAL_TRACK,
      future: [],
    })
  );
  const { items, arrows } = hist.present;
  const canUndo = hist.past.length > 0;
  const canRedo = hist.future.length > 0;

  // UI state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedId = selectedIds.size === 1 ? [...selectedIds][0] : null;
  const [selectedArrowId, setSelectedArrowId] = useState<string | null>(null);
  const [mode, setMode] = useState<"select" | "drawArrow">("select");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [subMenuKey, setSubMenuKey] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "pending" | "saved">("idle");
  const isMobile = useIsMobile();
  const [mobilePanel, setMobilePanel] = useState<"formations" | "properties" | null>(null);
  useEffect(() => { if (!isMobile) setMobilePanel(null); }, [isMobile]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived
  const selected = useMemo(() => items.find((it) => it.id === selectedId) ?? null, [items, selectedId]);
  const selectedArrow = useMemo(() => arrows.find((a) => a.id === selectedArrowId) ?? null, [arrows, selectedArrowId]);
  const issues = useMemo(() => runValidation(fieldWidth, fieldLength, items), [fieldWidth, fieldLength, items]);
  const errorCount = useMemo(() => issues.filter((i) => i.severity === "error").length, [issues]);
  const warnCount = useMemo(() => issues.filter((i) => i.severity === "warning").length, [issues]);
  const totalDurationSeconds = useMemo(
    () => items.reduce((sum, it) => sum + getEffectiveDuration(it.durationSeconds, it.key), 0),
    [items]
  );

  // Keyboard shortcuts — refs to avoid stale closures
  const selectedIdsRef = useRef(selectedIds);
  const selectedArrowIdRef = useRef(selectedArrowId);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { selectedArrowIdRef.current = selectedArrowId; }, [selectedArrowId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      const inputFocused = document.activeElement instanceof HTMLInputElement
        || document.activeElement instanceof HTMLTextAreaElement;

      if (meta && e.key === "z" && !e.shiftKey) { e.preventDefault(); dispatch({ type: "UNDO" }); return; }
      if (meta && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); dispatch({ type: "REDO" }); return; }
      if (e.key === "Escape") { setMode("select"); return; }
      if (!inputFocused && (e.key === "Delete" || e.key === "Backspace")) {
        const ids = [...selectedIdsRef.current];
        if (ids.length > 0) {
          ids.length === 1
            ? dispatch({ type: "DELETE_FORMATION", id: ids[0] })
            : dispatch({ type: "DELETE_FORMATIONS", ids });
          setSelectedIds(new Set());
        } else if (selectedArrowIdRef.current) {
          dispatch({ type: "DELETE_ARROW", id: selectedArrowIdRef.current });
          setSelectedArrowId(null);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Autosave — debounced 1 s after last change
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
    setSaveStatus("pending");
    saveTimerRef.current = setTimeout(() => {
      saveState({ items, arrows, manualWidth, manualLength, mapSatellite, mapOpacity, areaSel });
      setSaveStatus("saved");
      savedFadeRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    }, 1000);
  }, [items, arrows, manualWidth, manualLength, mapSatellite, mapOpacity, areaSel]);

  // Formation actions
  function addFormation(key: FormationKey, rotationDeg = 0) {
    const formation = getFormation(key);
    const newItem: PlacedFormation = {
      id: crypto.randomUUID(),
      key,
      x: 1,
      y: 1,
      rotationDeg,
      direction: formation.defaultDirection ?? "none",
    };
    dispatch({ type: "ADD_FORMATION", formation: newItem });
    setSelectedIds(new Set([newItem.id]));
    setSelectedArrowId(null);
    setSubMenuKey(null);
  }

  function updateFormation(id: string, patch: Partial<PlacedFormation>) {
    dispatch({ type: "UPDATE_FORMATION", id, patch });
  }

  function deleteFormation(id: string) {
    dispatch({ type: "DELETE_FORMATION", id });
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }

  // Arrow actions
  function handleArrowDrawn(a: Omit<PlacedArrow, "id">) {
    const newArrow: PlacedArrow = { id: crypto.randomUUID(), ...a };
    dispatch({ type: "ADD_ARROW", arrow: newArrow });
    setSelectedArrowId(newArrow.id);
    setSelectedIds(new Set());
    setMode("select");
  }

  function deleteArrow(id: string) {
    dispatch({ type: "DELETE_ARROW", id });
    setSelectedArrowId(null);
  }

  function handleSelectArrow(id: string | null) {
    setSelectedArrowId(id);
    if (id) setSelectedIds(new Set());
  }

  function handleSelectFormation(id: string, addToSelection = false) {
    if (addToSelection) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    } else {
      setSelectedIds(new Set([id]));
    }
    setSelectedArrowId(null);
  }

  function handleDeselectAll() {
    setSelectedIds(new Set());
    setSelectedArrowId(null);
  }

  function handleExport() {
    exportAsFile({ items, arrows, manualWidth, manualLength, mapSatellite, mapOpacity, areaSel });
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const saved = parseImportFile(ev.target?.result as string);
        dispatch({ type: "RESET", state: { items: saved.items, arrows: saved.arrows } });
        setAreaSel(saved.areaSel);
        setManualWidth(saved.manualWidth);
        setManualLength(saved.manualLength);
        setManualWidthInput(String(saved.manualWidth));
        setManualLengthInput(String(saved.manualLength));
        setMapSatellite(saved.mapSatellite);
        setMapOpacity(saved.mapOpacity);
        setSelectedIds(new Set());
        setSelectedArrowId(null);
      } catch (err) {
        alert(`Import fehlgeschlagen: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function toggleGroup(key: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const mapCenter = areaSel
    ? { lat: areaSel.centerLat, lng: areaSel.centerLng }
    : { lat: 50.517, lng: 7.317 };

  return (
    <div style={{ height: "100vh", overflow: "hidden", background: "#f1f5f9", color: "#0f172a", display: "flex", flexDirection: "column" }}>

      {/* ── Modal: Map Selector ─────────────────────────────────────── */}
      {showMapSelector && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 200,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={() => setShowMapSelector(false)}
        >
          <div
            style={{
              background: "white", borderRadius: 20, padding: 20,
              width: "min(900px, 96vw)", maxHeight: "90vh", overflow: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ margin: 0 }}>Streckenbereich auf der Karte markieren</h3>
              <button
                onClick={() => setShowMapSelector(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>
            <MapSelector
              initialLat={mapCenter.lat}
              initialLng={mapCenter.lng}
              initialZoom={17}
              initialSelection={areaSel ?? undefined}
              onSelect={(sel) => { setAreaSel(sel); setShowMapSelector(false); }}
              onCancel={() => setShowMapSelector(false)}
            />
          </div>
        </div>
      )}

      {/* ── Modal: Hilfe ────────────────────────────────────────────── */}
      {showHelp && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 200,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16, boxSizing: "border-box",
          }}
          onClick={() => setShowHelp(false)}
        >
          <div
            style={{
              background: "white", borderRadius: 20, padding: 22,
              width: "min(720px, 96vw)", maxHeight: "90vh", overflow: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <HelpCircle size={20} color="#0284c7" /> Hilfe
              </h3>
              <button
                onClick={() => setShowHelp(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", padding: 4 }}
                title="Schließen"
              >
                <X size={20} />
              </button>
            </div>
            <HelpContent />
          </div>
        </div>
      )}

      {/* ── Mobile drawer backdrop ──────────────────────────────────── */}
      {isMobile && mobilePanel && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 150 }}
          onClick={() => setMobilePanel(null)}
        />
      )}

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", maxWidth: 1600, width: "100%", margin: "0 auto", padding: isMobile ? "10px 10px" : "16px 20px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isMobile ? 8 : 16, flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 17 : 21, fontWeight: 800 }}>
            Kartslalom Streckenplaner
          </h1>
          <button
            onClick={() => setShowHelp(true)}
            style={{ ...iconBtnLabel, color: "#0284c7", borderColor: "#bae6fd" }}
            title="Hilfe öffnen"
          >
            <HelpCircle size={14} />
            <span>Hilfe</span>
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "276px 1fr 296px", gap: 14, flex: 1, minHeight: 0, overflow: "hidden" }}>

          {/* ── Left Sidebar (Formationen) ───────────────────────────── */}
          <aside style={isMobile ? mobileDrawerStyle("left", mobilePanel === "formations") : { display: "grid", gap: 12, alignContent: "start", overflowY: "auto", minHeight: 0 }}>
            {isMobile && <DrawerHeader title="Formationen" onClose={() => setMobilePanel(null)} />}

            {/* Area section */}
            <section style={card}>
              <SectionLabel>Streckenbereich</SectionLabel>
              {areaSel ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{
                    background: "#f0fdf4", border: "1px solid #bbf7d0",
                    borderRadius: 10, padding: "9px 12px", fontSize: 13,
                  }}>
                    <div style={{ fontWeight: 700, color: "#15803d", marginBottom: 2 }}>Bereich ausgewaehlt</div>
                    <div style={{ color: "#166534" }}>
                      {areaSel.widthM.toFixed(1)} m × {areaSel.heightM.toFixed(1)} m
                      {areaSel.rotationDeg !== 0 && ` · ${areaSel.rotationDeg}°`}
                    </div>
                  </div>
                  <button onClick={() => setShowMapSelector(true)} style={outlineBtn}>
                    <Map size={13} /> Neu waehlen
                  </button>
                  <button onClick={() => setAreaSel(null)} style={{ ...outlineBtn, color: "#b91c1c", borderColor: "#fecaca" }}>
                    <Trash2 size={13} /> Entfernen
                  </button>
                  <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10, display: "grid", gap: 8 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                      <input type="checkbox" checked={mapSatellite} onChange={(e) => setMapSatellite(e.target.checked)} />
                      <Satellite size={13} /> Satellitenbild
                    </label>
                    <label style={{ fontSize: 13 }}>
                      Transparenz: {Math.round(mapOpacity * 100)} %
                      <input type="range" min="0.1" max="1" step="0.05" value={mapOpacity}
                        onChange={(e) => setMapOpacity(Number(e.target.value))}
                        style={{ width: "100%", boxSizing: "border-box", marginTop: 4 }} />
                    </label>
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  <button onClick={() => setShowMapSelector(true)} style={{ ...outlineBtn, borderColor: "#0284c7", color: "#0284c7", fontWeight: 700 }}>
                    <Map size={13} /> Bereich auf Karte waehlen
                  </button>
                  <div style={{ fontSize: 11, color: "#64748b" }}>Oder manuell eingeben:</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <label style={{ fontSize: 12 }}>
                      Breite (m)
                      <input style={numInput} type="number" value={manualWidthInput}
                        onChange={(e) => { setManualWidthInput(e.target.value); const v = Number(e.target.value); if (!Number.isNaN(v)) setManualWidth(Math.max(8, v)); }}
                        onBlur={() => { const v = Number(manualWidthInput); if (Number.isNaN(v) || !manualWidthInput.trim()) { setManualWidthInput(String(manualWidth)); return; } const n = Math.max(8, v); setManualWidth(n); setManualWidthInput(String(n)); }}
                      />
                    </label>
                    <label style={{ fontSize: 12 }}>
                      Laenge (m)
                      <input style={numInput} type="number" value={manualLengthInput}
                        onChange={(e) => { setManualLengthInput(e.target.value); const v = Number(e.target.value); if (!Number.isNaN(v)) setManualLength(Math.max(8, v)); }}
                        onBlur={() => { const v = Number(manualLengthInput); if (Number.isNaN(v) || !manualLengthInput.trim()) { setManualLengthInput(String(manualLength)); return; } const n = Math.max(8, v); setManualLength(n); setManualLengthInput(String(n)); }}
                      />
                    </label>
                  </div>
                </div>
              )}
            </section>

            {/* Formation palette */}
            <section style={card}>
              <SectionLabel>Formationen</SectionLabel>
              <div style={{ display: "grid", gap: 4 }}>
                {FORMATION_GROUPS.map((group) => {
                  const open = openGroups.has(group.key);
                  const defs = group.formations.map((k) => getFormation(k));
                  return (
                    <div key={group.key}>
                      <button
                        onClick={() => toggleGroup(group.key)}
                        style={{
                          width: "100%", display: "flex", alignItems: "center",
                          justifyContent: "space-between",
                          background: "#f8fafc", border: "none", borderRadius: 8,
                          padding: "6px 10px", cursor: "pointer",
                          fontWeight: 600, fontSize: 12, color: "#475569",
                          marginBottom: open ? 4 : 0,
                        }}
                      >
                        <span>{group.label}</span>
                        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </button>
                      {open && (
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 5, paddingLeft: 2,
                        }}>
                          {defs.map((formation) => (
                            <PaletteCard
                              key={formation.key}
                              formation={formation}
                              onClick={(rotDeg) => addFormation(formation.key, rotDeg)}
                              showRotationSubMenu={group.rotationSubMenu}
                              subMenuOpen={subMenuKey === formation.key}
                              onToggleSubMenu={() => setSubMenuKey(subMenuKey === formation.key ? null : formation.key)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>

          {/* ── Canvas Section ────────────────────────────────────────── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 10, overflow: "hidden", minHeight: 0 }}>

            {/* Toolbar */}
            <div style={{
              background: "white", borderRadius: 14, padding: "9px 14px",
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              flexShrink: 0,
              overflowX: "auto", WebkitOverflowScrolling: "touch",
            }}>
              {isMobile && (
                <>
                  <button
                    onClick={() => setMobilePanel(mobilePanel === "formations" ? null : "formations")}
                    style={toolBtn(mobilePanel === "formations")}
                    title="Formationen ein-/ausblenden"
                  >
                    <Menu size={14} />
                    <span>Formationen</span>
                  </button>
                  <button
                    onClick={() => setMobilePanel(mobilePanel === "properties" ? null : "properties")}
                    style={toolBtn(mobilePanel === "properties")}
                    title="Eigenschaften ein-/ausblenden"
                  >
                    <SlidersHorizontal size={14} />
                    <span>Eigenschaften</span>
                  </button>
                  <div style={divider} />
                </>
              )}
              <button onClick={() => setMode("select")} style={toolBtn(mode === "select")} title="Auswählen (Esc)">
                <MousePointer size={14} />
                <span>Auswählen</span>
              </button>
              <button onClick={() => setMode("drawArrow")} style={toolBtn(mode === "drawArrow")} title="Pfeil zeichnen">
                <Pencil size={14} />
                <span>Pfeil</span>
              </button>

              <div style={divider} />

              <button onClick={() => dispatch({ type: "UNDO" })} disabled={!canUndo} style={iconBtn(!canUndo)} title="Rückgängig (⌘Z)">
                <Undo2 size={14} />
              </button>
              <button onClick={() => dispatch({ type: "REDO" })} disabled={!canRedo} style={iconBtn(!canRedo)} title="Wiederherstellen (⌘⇧Z)">
                <Redo2 size={14} />
              </button>

              <div style={divider} />

              <button
                onClick={() => setShowMapSelector(true)}
                style={{ ...iconBtnLabel, borderColor: areaSel ? "#0284c7" : "#cbd5e1", color: areaSel ? "#0284c7" : "#475569" }}
                title="Streckenbereich auf Karte auswählen / zoomen"
              >
                <Satellite size={14} />
                <span>{areaSel ? "Karte / Zoom" : "Karte wählen"}</span>
              </button>

              <div style={{ flex: 1 }} />

              {errorCount > 0 && (
                <div style={badge("error")}>
                  <AlertTriangle size={12} /> {errorCount} Fehler
                </div>
              )}
              {warnCount > 0 && (
                <div style={badge("warning")}>
                  <Info size={12} /> {warnCount} Hinweis{warnCount !== 1 ? "e" : ""}
                </div>
              )}
              {errorCount === 0 && warnCount === 0 && items.length > 0 && (
                <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>✓ Alles OK</span>
              )}

              <div style={divider} />

              {/* Export */}
              <button
                onClick={() => downloadSVG(generateTrackSVG(fieldWidth, fieldLength, items, arrows))}
                style={iconBtnLabel}
                title="Als SVG herunterladen"
              >
                <FileDown size={14} />
                <span>SVG</span>
              </button>
              <button
                onClick={() => printAsPDF(generateTrackSVG(fieldWidth, fieldLength, items, arrows), fieldWidth, fieldLength)}
                style={iconBtnLabel}
                title="Als PDF drucken"
              >
                <FileDown size={14} />
                <span>PDF</span>
              </button>
              <button onClick={handleExport} style={iconBtnLabel} title="Strecke als JSON-Datei speichern">
                <FileDown size={14} />
                <span>JSON</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={iconBtnLabel}
                title="Strecke aus JSON-Datei laden"
              >
                <FileDown size={14} style={{ transform: "rotate(180deg)" }} />
                <span>Laden</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={handleImport}
              />

              <div style={divider} />
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                {fieldWidth.toFixed(1)} × {fieldLength.toFixed(1)} m
              </span>

              {saveStatus !== "idle" && (
                <span style={{
                  fontSize: 12,
                  color: saveStatus === "saved" ? "#16a34a" : "#94a3b8",
                  transition: "color 0.3s",
                }}>
                  {saveStatus === "saved" ? "✓ Gespeichert" : "Speichern…"}
                </span>
              )}

              <div style={divider} />
              <button
                onClick={() => {
                  if (!confirm("Strecke zurücksetzen und gespeicherten Stand löschen?")) return;
                  clearSavedState();
                  _initialSaved = null;
                  dispatch({ type: "UNDO" }); // force re-render workaround
                  window.location.reload();
                }}
                style={{ ...iconBtnLabel, color: "#b91c1c", borderColor: "#fecaca" }}
                title="Neu beginnen"
              >
                <Trash2 size={14} />
                <span>Neu</span>
              </button>
            </div>

            {/* Canvas */}
            <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
            <TrackCanvas
              fieldWidth={fieldWidth}
              fieldLength={fieldLength}
              items={items}
              selectedIds={selectedIds}
              onSelect={handleSelectFormation}
              onMove={(id, dx, dy) => dispatch({ type: "MOVE_FORMATION", id, dx, dy })}
              onMoveMultiple={(ids, dx, dy) => dispatch({ type: "MOVE_FORMATIONS", ids, dx, dy })}
              onFormationDragStart={() => dispatch({ type: "CHECKPOINT" })}
              onDeselectAll={handleDeselectAll}
              issues={issues}
              drawingArrowMode={mode === "drawArrow"}
              onArrowDrawn={handleArrowDrawn}
              arrows={arrows}
              selectedArrowId={selectedArrowId}
              onSelectArrow={handleSelectArrow}
              onArrowCpMove={(id, dx, dy) => dispatch({ type: "MOVE_ARROW_CP", id, dx, dy })}
              onArrowEndpointMove={(id, handle, dx, dy) => dispatch({ type: "MOVE_ARROW_ENDPOINT", id, handle, dx, dy })}
              mapConfig={mapConfig}
            />
            </div>
          </section>

          {/* ── Right Panel (Eigenschaften) ──────────────────────────── */}
          <aside style={isMobile ? mobileDrawerStyle("right", mobilePanel === "properties") : { display: "grid", gap: 12, alignContent: "start", overflowY: "auto", minHeight: 0 }}>
            {isMobile && <DrawerHeader title="Eigenschaften" onClose={() => setMobilePanel(null)} />}

            {/* Properties */}
            <section style={card}>
              <SectionLabel>Eigenschaften</SectionLabel>

              {selectedIds.size === 0 && !selectedArrow && (
                <div style={{ color: "#94a3b8", fontSize: 13 }}>
                  Formation oder Pfeil auswählen.<br />
                  <span style={{ fontSize: 11, color: "#cbd5e1" }}>Shift+Klick für Mehrfachauswahl</span>
                </div>
              )}

              {selectedIds.size > 1 && !selectedArrow && (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedIds.size} Formationen ausgewählt</div>
                  <div style={{ fontSize: 12, color: "#475569", background: "#f8fafc", borderRadius: 8, padding: 10 }}>
                    Ziehe eine der markierten Formationen, um alle gemeinsam zu verschieben.
                  </div>
                  <button
                    onClick={() => {
                      dispatch({ type: "DELETE_FORMATIONS", ids: [...selectedIds] });
                      setSelectedIds(new Set());
                    }}
                    style={dangerBtn}
                  >
                    <Trash2 size={13} /> Alle löschen
                  </button>
                </div>
              )}

              {selectedArrow && (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontWeight: 700 }}>Pfeil</div>
                  <div style={{
                    fontSize: 12, color: "#475569",
                    background: "#f8fafc", borderRadius: 8, padding: 10, lineHeight: 1.7,
                  }}>
                    <strong>Oranger Punkt:</strong> krümmen<br />
                    <strong>Weiße Punkte:</strong> Start/Ende verschieben
                  </div>
                  <button onClick={() => deleteArrow(selectedArrowId!)} style={dangerBtn}>
                    <Trash2 size={13} /> Pfeil löschen
                  </button>
                </div>
              )}

              {selected && (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{getFormation(selected.key).label}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <label style={{ fontSize: 12 }}>
                      X (m)
                      <input style={numInput} type="number" step="0.1" value={selected.x}
                        onChange={(e) => updateFormation(selected.id, { x: Number(e.target.value) || 0 })} />
                    </label>
                    <label style={{ fontSize: 12 }}>
                      Y (m)
                      <input style={numInput} type="number" step="0.1" value={selected.y}
                        onChange={(e) => updateFormation(selected.id, { y: Number(e.target.value) || 0 })} />
                    </label>
                  </div>
                  <label style={{ fontSize: 12 }}>
                    Winkel (°)
                    <input style={numInput} type="number" step="1" value={selected.rotationDeg}
                      onChange={(e) => updateFormation(selected.id, { rotationDeg: Number(e.target.value) || 0 })} />
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button
                      onClick={() => updateFormation(selected.id, { rotationDeg: selected.rotationDeg - 15 })}
                      style={outlineBtn}
                    >
                      ↺ −15°
                    </button>
                    <button
                      onClick={() => updateFormation(selected.id, { rotationDeg: selected.rotationDeg + 15 })}
                      style={outlineBtn}
                    >
                      <RotateCw size={12} /> +15°
                    </button>
                  </div>
                  <label style={{ fontSize: 12 }}>
                    Durchfahrzeit (s)
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <input
                        style={{ ...numInput, flex: 1 }}
                        type="number"
                        min="0"
                        step="1"
                        value={selected.durationSeconds ?? getFormation(selected.key).defaultDurationSeconds ?? 0}
                        onChange={(e) => updateFormation(selected.id, { durationSeconds: Math.max(0, Number(e.target.value) || 0) })}
                      />
                      {selected.durationSeconds !== undefined && (
                        <button
                          onClick={() => updateFormation(selected.id, { durationSeconds: undefined })}
                          title="Auf Standard zurücksetzen"
                          style={{
                            border: "1px solid #cbd5e1", background: "white", borderRadius: 7,
                            padding: "5px 7px", cursor: "pointer", fontSize: 11, color: "#64748b",
                            flexShrink: 0,
                          }}
                        >
                          ↺
                        </button>
                      )}
                    </div>
                    {selected.durationSeconds !== undefined && (
                      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                        Standard: {getFormation(selected.key).defaultDurationSeconds ?? 0} s
                      </div>
                    )}
                  </label>
                  <button onClick={() => deleteFormation(selected.id)} style={dangerBtn}>
                    <Trash2 size={13} /> Löschen
                  </button>
                </div>
              )}
            </section>

            {/* Course duration */}
            <section style={card}>
              <SectionLabel>Kursdauer</SectionLabel>
              {items.length === 0 ? (
                <div style={{ fontSize: 13, color: "#94a3b8" }}>Noch keine Formationen platziert.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{
                    background: "#f0f9ff", border: "1px solid #bae6fd",
                    borderRadius: 10, padding: "10px 12px",
                    display: "flex", alignItems: "baseline", gap: 6,
                  }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: "#0284c7", lineHeight: 1 }}>
                      {totalDurationSeconds}
                    </span>
                    <span style={{ fontSize: 13, color: "#0369a1", fontWeight: 600 }}>Sekunden</span>
                    <span style={{ fontSize: 11, color: "#7dd3fc", marginLeft: "auto" }}>
                      ≈ {Math.floor(totalDurationSeconds / 60)}:{String(totalDurationSeconds % 60).padStart(2, "0")} min
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                    Richtwert basierend auf den Durchfahrzeiten der Formationen. Pro Formation anpassbar.
                  </div>
                </div>
              )}
            </section>

            {/* Validation — always visible */}
            <section style={card}>
              <SectionLabel>Prüfung</SectionLabel>
              {issues.length === 0 ? (
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  {items.length === 0 ? "Noch keine Formationen platziert." : "Keine Auffälligkeiten."}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 7 }}>
                  {issues.map((issue) => {
                    const isErr = issue.severity === "error";
                    const clickable = !!issue.formationId;
                    return (
                      <div
                        key={issue.id}
                        onClick={() => {
                          if (issue.formationId) {
                            handleSelectFormation(issue.formationId, false);
                          }
                        }}
                        style={{
                          borderRadius: 10,
                          border: isErr ? "1px solid #fecaca" : "1px solid #fde68a",
                          background: isErr ? "#fff1f2" : "#fffbeb",
                          padding: "8px 10px",
                          cursor: clickable ? "pointer" : "default",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 600, fontSize: 12 }}>
                          {isErr
                            ? <AlertTriangle size={13} color="#ef4444" />
                            : <Info size={13} color="#f59e0b" />
                          }
                          <span style={{ flex: 1 }}>{issue.message}</span>
                          {clickable && <span style={{ fontSize: 10, color: "#94a3b8" }}>→</span>}
                        </div>
                        {issue.details && (
                          <div style={{ fontSize: 11, color: "#475569", marginTop: 4, paddingLeft: 20 }}>
                            {issue.details}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </aside>

        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function DrawerHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title}</h2>
      <button
        onClick={onClose}
        style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", padding: 4 }}
        title="Schließen"
      >
        <X size={20} />
      </button>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.06em", color: "#94a3b8", marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

function HelpSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 16 }}>
      <h4 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{title}</h4>
      <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{children}</div>
    </section>
  );
}

function HelpContent() {
  const kbd: React.CSSProperties = {
    display: "inline-block", border: "1px solid #cbd5e1", borderBottom: "2px solid #cbd5e1",
    borderRadius: 5, padding: "1px 6px", fontSize: 12, fontFamily: "monospace",
    background: "#f8fafc", color: "#334155",
  };
  return (
    <div>
      <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, marginTop: 4 }}>
        Mit dem Kartslalom Streckenplaner entwirfst du Pylonen-Strecken, prüfst sie
        gegen grundlegende Regeln und exportierst sie als Plan zum Aufbau auf der
        Strecke. Alle Eingaben bleiben lokal in diesem Browser gespeichert — es wird
        nichts an einen Server übertragen.
      </p>

      <HelpSection title="1. Streckenbereich festlegen">
        Wähle entweder über <strong>„Bereich auf Karte wählen“</strong> einen
        rechteckigen Ausschnitt auf der (Satelliten-)Karte aus — du kannst ihn dort
        verschieben, in der Größe anpassen und drehen — oder gib links unter
        „Streckenbereich“ Breite und Länge in Metern manuell ein (Mindestgröße 8 m).
        Über das Kartensymbol in der Werkzeugleiste kannst du den Ausschnitt jederzeit
        neu wählen, die Sichtbarkeit als Satellitenbild umschalten und seine
        Transparenz anpassen.
      </HelpSection>

      <HelpSection title="2. Formationen platzieren">
        Klicke links in der Palette auf eine Formation, um sie auf der Fläche
        einzufügen. Formationen mit Drehrichtung (z. B. Kurven) besitzen ein kleines
        Drehsymbol — darüber lässt sich eine Rotationsvariante (0°/90°/180°/270°)
        direkt beim Einfügen wählen. Formationen sind nach Kategorien gruppiert
        (Start/Ziel, Basis, Kurven, Komplex) und lassen sich per Klick auf den
        Gruppentitel ein- und ausklappen.
      </HelpSection>

      <HelpSection title="3. Formationen bearbeiten">
        Ziehe eine Formation mit der Maus, um sie zu verschieben. Mit{" "}
        <strong>Shift+Klick</strong> wählst du mehrere Formationen gleichzeitig aus
        und kannst sie gemeinsam verschieben oder löschen. Bei einer einzelnen
        Auswahl zeigt das Feld „Eigenschaften“ rechts Position (X/Y), Drehwinkel und
        die <strong>Durchfahrzeit</strong> der Formation — Letztere lässt sich pro
        Formation überschreiben und mit dem Rückgängig-Symbol wieder auf den
        Standardwert zurücksetzen.
      </HelpSection>

      <HelpSection title="4. Pfeile zeichnen">
        Wechsle über das Stift-Symbol in den Pfeil-Modus und ziehe einen Pfeil auf
        die Fläche, um die Fahrtrichtung zu markieren. Ein ausgewählter Pfeil zeigt
        drei Punkte: den <strong>orangen Punkt</strong> zum Krümmen sowie zwei{" "}
        <strong>weiße Punkte</strong> zum Verschieben von Start und Ende.
      </HelpSection>

      <HelpSection title="5. Prüfung & Hinweise">
        Der Bereich „Prüfung“ zeigt automatisch Fehler (rot) und Hinweise (gelb) an —
        z. B. wenn Formationen über den Rand hinausragen, zu nah aneinander oder zu
        weit auseinander stehen, die Strecke in getrennte Bereiche zerfällt oder ein
        Vorstartbereich bzw. eine Wechselzone fehlt. Ein Klick auf eine Meldung
        markiert die betroffene Formation auf der Fläche.
      </HelpSection>

      <HelpSection title="6. Kursdauer">
        Unter „Kursdauer“ siehst du die geschätzte Gesamt-Durchfahrzeit deiner
        Strecke (Summe der Durchfahrzeiten aller platzierten Formationen) als
        Richtwert in Sekunden und Minuten.
      </HelpSection>

      <HelpSection title="7. Speichern, Zurücksetzen, Importieren/Exportieren">
        Deine Strecke wird automatisch im Browser gespeichert (Anzeige
        „Gespeichert“ in der Werkzeugleiste) und beim nächsten Besuch
        wiederhergestellt. Über die Symbole in der Werkzeugleiste kannst du die
        Strecke zusätzlich als <strong>SVG</strong> herunterladen, als{" "}
        <strong>PDF</strong> drucken (öffnet den Druckdialog des Browsers) oder als{" "}
        <strong>JSON-Datei</strong> sichern bzw. wieder <strong>laden</strong> — z. B.
        um sie auf einem anderen Gerät weiterzubearbeiten oder mit anderen zu teilen.
        Über „Neu“ setzt du die Strecke zurück und löschst den gespeicherten Stand
        (mit Sicherheitsabfrage).
      </HelpSection>

      <HelpSection title="8. Tastaturkürzel">
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 14px", alignItems: "center", marginTop: 4 }}>
          <span><span style={kbd}>⌘ Z</span> / <span style={kbd}>Strg Z</span></span>
          <span>Rückgängig</span>
          <span><span style={kbd}>⌘ ⇧ Z</span> / <span style={kbd}>Strg Y</span></span>
          <span>Wiederherstellen</span>
          <span><span style={kbd}>Esc</span></span>
          <span>Zurück in den Auswahl-Modus</span>
          <span><span style={kbd}>Entf</span> / <span style={kbd}>⌫</span></span>
          <span>Auswahl löschen (Formation oder Pfeil)</span>
          <span><span style={kbd}>⇧</span> + Klick</span>
          <span>Mehrfachauswahl von Formationen</span>
        </div>
      </HelpSection>

      <HelpSection title="9. Mobile Bedienung">
        Auf schmalen Bildschirmen wird die Ansicht einspaltig dargestellt. Über die
        Schaltflächen <strong>„Formationen“</strong> und <strong>„Eigenschaften“</strong>{" "}
        in der Werkzeugleiste blendest du die jeweiligen Bereiche als seitliche
        Schublade ein und aus.
      </HelpSection>
    </div>
  );
}

function PaletteCard({
  formation,
  onClick,
  showRotationSubMenu,
  subMenuOpen,
  onToggleSubMenu,
}: {
  formation: ReturnType<typeof getFormation>;
  onClick: (rotDeg: number) => void;
  showRotationSubMenu?: boolean;
  subMenuOpen?: boolean;
  onToggleSubMenu?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const ROTATIONS = [0, 90, 180, 270];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ position: "relative", display: "flex" }}>
        <button
          onClick={() => onClick(0)}
          title={formation.description}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            flex: 1,
            borderRadius: showRotationSubMenu ? "10px 0 0 10px" : 10,
            border: hovered ? "1px solid #94a3b8" : "1px solid #e2e8f0",
            borderRight: showRotationSubMenu ? "none" : undefined,
            background: hovered ? "#f8fafc" : "#fff",
            padding: "8px 6px",
            cursor: "pointer",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 5,
            transition: "border-color 0.12s, background 0.12s",
          }}
        >
          <FormationThumbnail formation={formation} size={48} />
          <span style={{ fontSize: 11, fontWeight: 600, color: "#334155", lineHeight: 1.2 }}>
            {formation.label}
          </span>
        </button>
        {showRotationSubMenu && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSubMenu?.(); }}
            title="Rotationsvarianten anzeigen"
            style={{
              borderRadius: "0 10px 10px 0",
              border: "1px solid #e2e8f0",
              borderLeft: "1px solid #e2e8f0",
              background: subMenuOpen ? "#e0f2fe" : "#f8fafc",
              padding: "0 5px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              color: subMenuOpen ? "#0284c7" : "#94a3b8",
              fontSize: 10,
              transition: "background 0.12s",
            }}
          >
            <RotateCw size={11} />
          </button>
        )}
      </div>
      {subMenuOpen && showRotationSubMenu && (
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 3,
          background: "#f0f9ff",
          border: "1px solid #bae6fd",
          borderRadius: 8,
          padding: 5,
        }}>
          {ROTATIONS.map((deg) => (
            <button
              key={deg}
              onClick={() => onClick(deg)}
              title={`${deg}° gedreht einfügen`}
              style={{
                borderRadius: 7,
                border: "1px solid #bae6fd",
                background: "white",
                padding: "4px 3px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
              }}
            >
              <FormationThumbnail formation={formation} size={36} rotationDeg={deg} />
              <span style={{ fontSize: 10, color: "#0369a1", fontWeight: 600 }}>{deg}°</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared styles ────────────────────────────────────────────────────

function mobileDrawerStyle(side: "left" | "right", open: boolean): React.CSSProperties {
  return {
    position: "fixed", top: 0, bottom: 0, [side]: 0,
    width: "min(85vw, 320px)",
    background: "#f1f5f9", zIndex: 160,
    overflowY: "auto", minHeight: 0,
    display: "grid", gap: 12, alignContent: "start",
    padding: 14, boxSizing: "border-box",
    boxShadow: side === "left" ? "4px 0 24px rgba(0,0,0,0.18)" : "-4px 0 24px rgba(0,0,0,0.18)",
    transform: open ? "translateX(0)" : `translateX(${side === "left" ? "-110%" : "110%"})`,
    transition: "transform 0.25s ease",
  };
}

const card: React.CSSProperties = {
  background: "white",
  borderRadius: 16,
  padding: 14,
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

const outlineBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  width: "100%", borderRadius: 10,
  border: "1px solid #cbd5e1", background: "white",
  padding: "7px 10px", cursor: "pointer", fontSize: 12,
  boxSizing: "border-box",
};

const dangerBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  width: "100%", borderRadius: 10,
  border: "1px solid #fecaca", background: "white",
  padding: "7px 10px", cursor: "pointer", fontSize: 12,
  color: "#b91c1c", boxSizing: "border-box",
};

const numInput: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", display: "block",
  marginTop: 3, padding: "5px 8px", borderRadius: 7,
  border: "1px solid #cbd5e1", fontSize: 13,
};

const divider: React.CSSProperties = {
  width: 1, height: 22, background: "#e2e8f0", flexShrink: 0,
};

function toolBtn(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    borderRadius: 9, border: active ? "2px solid #0284c7" : "1px solid #cbd5e1",
    background: active ? "#e0f2fe" : "white",
    padding: "6px 12px", cursor: "pointer",
    color: active ? "#0284c7" : "#475569",
    fontWeight: active ? 700 : 400,
    fontSize: 12,
  };
}

function iconBtn(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    borderRadius: 8, border: "1px solid #e2e8f0",
    background: disabled ? "#f8fafc" : "white",
    padding: 6, cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? "#cbd5e1" : "#475569",
    width: 30, height: 30, flexShrink: 0,
  };
}

function badge(type: "error" | "warning"): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 5,
    background: type === "error" ? "#fff1f2" : "#fffbeb",
    border: `1px solid ${type === "error" ? "#fecaca" : "#fde68a"}`,
    borderRadius: 8, padding: "3px 9px",
    fontSize: 12, fontWeight: 700,
    color: type === "error" ? "#b91c1c" : "#92400e",
    flexShrink: 0,
  };
}

const iconBtnLabel: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  borderRadius: 9, border: "1px solid #cbd5e1", background: "white",
  padding: "6px 10px", cursor: "pointer",
  color: "#475569", fontSize: 12, flexShrink: 0,
};
