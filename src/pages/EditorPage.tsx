// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import React, { useMemo, useReducer, useRef, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { X, HelpCircle } from "lucide-react";
import TrackCanvas from "../components/TrackCanvas";
import type { MapConfig } from "../components/TrackCanvas";
import MapSelector from "../components/MapSelector";
import { getEffectiveDuration } from "../lib/formationRegistry";
import { runValidation } from "../lib/validation";
import { generateTrackSVG, downloadSVG, printAsPDF } from "../lib/exportSVG";
import type { AreaSelection } from "../lib/areaSelection";
import type { FormationKey, PlacedArrow, PlacedFormation } from "../types";
import { saveState, loadState, clearSavedState, exportAsFile, parseImportFile } from "../lib/storage";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/authStore";
import { useTrack, useCreateTrack, useSaveTrack, useRenameTrack } from "../hooks/useTracks";
import { useTier } from "../hooks/useTier";
import { getFormation } from "../lib/formationRegistry";
import { trackReducer, INITIAL_TRACK } from "./editor/trackReducer";
import { useIsMobile } from "./editor/hooks/useIsMobile";
import EditorHeader from "./editor/components/EditorHeader";
import LeftSidebar from "./editor/components/LeftSidebar";
import Toolbar from "./editor/components/Toolbar";
import RightPanel from "./editor/components/RightPanel";
import HelpContent from "./editor/components/HelpContent";

// Load once at startup, shared across all useState lazy initializers (Gast-Modus)
let _initialSaved = loadState();

export default function EditorPage() {
  const { trackId: trackIdParam } = useParams<{ trackId: string }>();
  const navigate = useNavigate();
  const { session } = useAuthStore();
  const isCloudMode = !!session;
  const { canUseSatellite } = useTier();
  const satelliteLocked = isCloudMode && !canUseSatellite;
  const isNewTrack = !trackIdParam || trackIdParam === "new";
  const trackId = isNewTrack ? null : trackIdParam!;

  const trackQuery = useTrack(isCloudMode && !isNewTrack ? trackId! : undefined);
  const createTrackMutation = useCreateTrack();
  const saveTrackMutation = useSaveTrack();
  const renameTrackMutation = useRenameTrack();
  const createCalledRef = useRef(false);
  const cloudAppliedRef = useRef(false);
  const [cloudLoaded, setCloudLoaded] = useState(!isCloudMode);

  // Area / map
  const [areaSel, setAreaSel] = useState<AreaSelection | null>(() => _initialSaved?.areaSel ?? null);
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [manualWidth, setManualWidth] = useState(() => _initialSaved?.manualWidth ?? 18);
  const [manualLength, setManualLength] = useState(() => _initialSaved?.manualLength ?? 36);
  const [manualWidthInput, setManualWidthInput] = useState(() => String(_initialSaved?.manualWidth ?? 18));
  const [manualLengthInput, setManualLengthInput] = useState(() => String(_initialSaved?.manualLength ?? 36));
  const [mapSatellite, setMapSatellite] = useState(() => _initialSaved?.mapSatellite ?? (isCloudMode ? false : true));
  const [mapOpacity, setMapOpacity] = useState(() => _initialSaved?.mapOpacity ?? 0.5);

  const fieldWidth = areaSel ? areaSel.widthM : manualWidth;
  const fieldLength = areaSel ? areaSel.heightM : manualLength;
  const mapConfig: MapConfig | null = areaSel
    ? { selection: areaSel, satellite: mapSatellite, opacity: mapOpacity }
    : null;

  // Track + history
  const [hist, dispatch] = useReducer(
    trackReducer,
    null,
    (_: null) => ({
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
  const [trackName, setTrackName] = useState("Neue Strecke");
  const [nameFocused, setNameFocused] = useState(false);
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

  // Cloud: create new track + redirect
  useEffect(() => {
    if (!isCloudMode || !isNewTrack || createCalledRef.current) return;
    createCalledRef.current = true;
    createTrackMutation.mutate(undefined, {
      onSuccess: (id) => navigate(`/editor/${id}`, { replace: true }),
      onError: (err) => {
        if (err instanceof Error && err.message === "TRACK_LIMIT_REACHED") {
          alert("Du hast die maximale Anzahl an Strecken für deinen Tarif erreicht.");
        }
        navigate("/dashboard", { replace: true });
      },
    });
  }, [isCloudMode, isNewTrack]);

  // Cloud: apply loaded track data once
  useEffect(() => {
    if (!isCloudMode || isNewTrack || !trackQuery.data || cloudAppliedRef.current) return;
    cloudAppliedRef.current = true;
    const d = trackQuery.data;
    dispatch({
      type: "RESET",
      state: {
        items: (d.state_json.items ?? []) as PlacedFormation[],
        arrows: (d.state_json.arrows ?? []) as PlacedArrow[],
      },
    });
    setAreaSel((d.area_sel_json as AreaSelection | null) ?? null);
    setManualWidth(d.manual_width);
    setManualLength(d.manual_length);
    setManualWidthInput(String(d.manual_width));
    setManualLengthInput(String(d.manual_length));
    setMapSatellite(d.map_satellite);
    setMapOpacity(d.map_opacity);
    setTrackName(d.name);
    setCloudLoaded(true);
  }, [isCloudMode, isNewTrack, trackQuery.data]);

  // Autosave — debounced 1 s after last change
  useEffect(() => {
    if (!cloudLoaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
    setSaveStatus("pending");
    saveTimerRef.current = setTimeout(async () => {
      if (isCloudMode && trackId) {
        try {
          await saveTrackMutation.mutateAsync({
            id: trackId,
            state: { items, arrows, manualWidth, manualLength, mapSatellite, mapOpacity, areaSel },
          });
        } catch (err) {
          if (err instanceof Error && err.message === "SATELLITE_REQUIRES_PRO") {
            setMapSatellite(false);
            alert("Satellitenbilder sind ab dem Pro-Tarif verfügbar.");
          }
          setSaveStatus("idle");
          return;
        }
      } else {
        saveState({ items, arrows, manualWidth, manualLength, mapSatellite, mapOpacity, areaSel });
      }
      setSaveStatus("saved");
      savedFadeRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    }, 1000);
  }, [items, arrows, manualWidth, manualLength, mapSatellite, mapOpacity, areaSel, cloudLoaded]);

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

  // Track name handlers (rename mutation stays here where renameTrackMutation lives)
  function handleNameBlur() {
    setNameFocused(false);
    const trimmed = trackName.trim();
    if (trimmed && trimmed !== trackQuery.data?.name) {
      renameTrackMutation.mutate({ id: trackId!, name: trimmed });
    } else if (!trimmed) {
      setTrackName(trackQuery.data?.name ?? "Neue Strecke");
    }
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
    if (e.key === "Escape") {
      setTrackName(trackQuery.data?.name ?? "Neue Strecke");
      (e.target as HTMLInputElement).blur();
    }
  }

  function handleReset() {
    if (!confirm("Strecke zurücksetzen und gespeicherten Stand löschen?")) return;
    clearSavedState();
    _initialSaved = null;
    dispatch({ type: "UNDO" }); // force re-render workaround
    window.location.reload();
  }

  const mapCenter = areaSel
    ? { lat: areaSel.centerLat, lng: areaSel.centerLng }
    : { lat: 50.517, lng: 7.317 };

  if (isCloudMode && isNewTrack) {
    return <div style={{ padding: 40 }}>Neue Strecke wird angelegt…</div>;
  }
  if (isCloudMode && !isNewTrack && !cloudLoaded) {
    if (trackQuery.isError) {
      return <div style={{ padding: 40 }}>Strecke konnte nicht geladen werden.</div>;
    }
    return <div style={{ padding: 40 }}>Lädt…</div>;
  }

  return (
    <div style={{ height: "100vh", overflow: "hidden", background: "#f1f5f9", color: "#0f172a", display: "flex", flexDirection: "column" }}>

      {/* ── Modal: Map Selector ─────────────────────────────────────── */}
      {showMapSelector && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowMapSelector(false)}
        >
          <div
            style={{ background: "white", borderRadius: 20, padding: 20, width: "min(900px, 96vw)", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ margin: 0 }}>Streckenbereich auf der Karte markieren</h3>
              <button onClick={() => setShowMapSelector(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", padding: 4 }}>
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
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box" }}
          onClick={() => setShowHelp(false)}
        >
          <div
            style={{ background: "white", borderRadius: 20, padding: 22, width: "min(720px, 96vw)", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.35)", boxSizing: "border-box" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <HelpCircle size={20} color="#0284c7" /> Hilfe
              </h3>
              <button onClick={() => setShowHelp(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", padding: 4 }} title="Schließen">
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

        <EditorHeader
          isMobile={isMobile}
          isCloudMode={isCloudMode}
          trackId={trackId}
          trackName={trackName}
          nameFocused={nameFocused}
          onSetTrackName={setTrackName}
          onNameFocus={() => setNameFocused(true)}
          onNameBlur={handleNameBlur}
          onNameKeyDown={handleNameKeyDown}
          onShowHelp={() => setShowHelp(true)}
          onSignOut={async () => { await supabase.auth.signOut(); navigate("/login"); }}
        />

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "276px 1fr 296px", gap: 14, flex: 1, minHeight: 0, overflow: "hidden" }}>

          <LeftSidebar
            isMobile={isMobile}
            mobileOpen={mobilePanel === "formations"}
            onClose={() => setMobilePanel(null)}
            areaSel={areaSel}
            onOpenMapSelector={() => setShowMapSelector(true)}
            onClearArea={() => setAreaSel(null)}
            mapSatellite={mapSatellite}
            onSetMapSatellite={setMapSatellite}
            satelliteLocked={satelliteLocked}
            mapOpacity={mapOpacity}
            onSetMapOpacity={setMapOpacity}
            manualWidthInput={manualWidthInput}
            manualLengthInput={manualLengthInput}
            onManualWidthChange={(raw, parsed) => { setManualWidthInput(raw); if (!Number.isNaN(parsed)) setManualWidth(Math.max(8, parsed)); }}
            onManualLengthChange={(raw, parsed) => { setManualLengthInput(raw); if (!Number.isNaN(parsed)) setManualLength(Math.max(8, parsed)); }}
            onManualWidthBlur={() => { const v = Number(manualWidthInput); if (Number.isNaN(v) || !manualWidthInput.trim()) { setManualWidthInput(String(manualWidth)); return; } const n = Math.max(8, v); setManualWidth(n); setManualWidthInput(String(n)); }}
            onManualLengthBlur={() => { const v = Number(manualLengthInput); if (Number.isNaN(v) || !manualLengthInput.trim()) { setManualLengthInput(String(manualLength)); return; } const n = Math.max(8, v); setManualLength(n); setManualLengthInput(String(n)); }}
            openGroups={openGroups}
            onToggleGroup={toggleGroup}
            subMenuKey={subMenuKey}
            onToggleSubMenu={(key) => setSubMenuKey(subMenuKey === key ? null : key)}
            onAddFormation={addFormation}
          />

          {/* Canvas */}
          <section style={{ display: "flex", flexDirection: "column", gap: 10, overflow: "hidden", minHeight: 0 }}>
            <Toolbar
              isMobile={isMobile}
              mobilePanel={mobilePanel}
              onSetMobilePanel={setMobilePanel}
              mode={mode}
              onSetMode={setMode}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={() => dispatch({ type: "UNDO" })}
              onRedo={() => dispatch({ type: "REDO" })}
              areaSel={areaSel}
              onOpenMapSelector={() => setShowMapSelector(true)}
              errorCount={errorCount}
              warnCount={warnCount}
              hasItems={items.length > 0}
              fieldWidth={fieldWidth}
              fieldLength={fieldLength}
              saveStatus={saveStatus}
              onExportSVG={() => downloadSVG(generateTrackSVG(fieldWidth, fieldLength, items, arrows))}
              onExportPDF={() => printAsPDF(generateTrackSVG(fieldWidth, fieldLength, items, arrows), fieldWidth, fieldLength)}
              onExportJSON={handleExport}
              onImportClick={() => fileInputRef.current?.click()}
              onImportChange={handleImport}
              fileInputRef={fileInputRef}
              onReset={handleReset}
            />
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

          <RightPanel
            isMobile={isMobile}
            mobileOpen={mobilePanel === "properties"}
            onClose={() => setMobilePanel(null)}
            selectedIds={selectedIds}
            selected={selected}
            selectedArrow={selectedArrow}
            selectedArrowId={selectedArrowId}
            onUpdateFormation={updateFormation}
            onDeleteFormation={deleteFormation}
            onDeleteSelectedFormations={() => { dispatch({ type: "DELETE_FORMATIONS", ids: [...selectedIds] }); setSelectedIds(new Set()); }}
            onDeleteArrow={deleteArrow}
            onSelectFormation={handleSelectFormation}
            totalDurationSeconds={totalDurationSeconds}
            hasItems={items.length > 0}
            issues={issues}
          />

        </div>
      </div>
    </div>
  );
}
