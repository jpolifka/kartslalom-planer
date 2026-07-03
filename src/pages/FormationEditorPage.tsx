// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFormationEditor, type EditorSnap, type EditableCone } from "../hooks/useFormationEditor";
import FormationEditorCanvas, { type EditorTool, type MeasurementLine, type GuideLine } from "../components/formation-editor/FormationEditorCanvas";
import FormationMetaPanel from "../components/formation-editor/FormationMetaPanel";
import BasisAuswahl from "../components/formation-editor/BasisAuswahl";
import { useCustomFormation, useCreateCustomFormation, useUpdateCustomFormation, useFormationPermission, useDuplicateCustomFormation, useAdminFormation, useAdminUpdateFormation } from "../hooks/useCustomFormations";
import { useFeatureGate } from "../hooks/useFeatureGate";
import { useAuthStore } from "../store/authStore";
import { useProfile } from "../hooks/useProfile";
import { normalizeCones, boundsFromCones, translateCones } from "../lib/geometry";
import type { FormationCategory, FormationKey, ConePoint } from "../types";
import { TASK_LANE_WIDTH, PYLON_FOOT_SIZE } from "../lib/formations/common";

const DRAFT_KEY = "kartslalom-formation-draft";

type DraftData = {
  snap: EditorSnap;
  name: string;
  description: string;
  category: FormationCategory;
  durationSeconds: number | null;
  lichteBreite: number | null;
  sourceFormationKey?: FormationKey;
};

function loadDraft(): DraftData | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as DraftData) : null;
  } catch { return null; }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

const TOOL_LABELS: Record<EditorTool, string> = {
  select: "Auswahl",
  standing: "Stehend",
  lying: "Liegend",
  sensor: "Sensor",
  arrow: "Pfeil",
  gatePair: "Breite messen",
  guideH: "─ H-Linie",
  guideV: "│ V-Linie",
};

const TOOLS: EditorTool[] = ["select", "standing", "lying", "sensor", "arrow", "gatePair", "guideH", "guideV"];

const s: Record<string, React.CSSProperties> = {
  page: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0, fontFamily: "system-ui, sans-serif", background: "#f9fafb" },
  header: { display: "flex", alignItems: "center", gap: 12, padding: "0 16px", height: 52, background: "white", borderBottom: "1px solid #e5e7eb", flexShrink: 0 },
  title: { fontSize: 15, fontWeight: 700, color: "#111827", flex: 1 },
  body: { display: "flex", flex: 1, overflow: "hidden" },
  left: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0 },
  toolbar: { display: "flex", gap: 4, padding: "8px 12px", background: "white", borderBottom: "1px solid #e5e7eb", flexWrap: "wrap" as const, alignItems: "center" },
  toolBtn: { padding: "5px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", background: "white" },
  toolBtnActive: { padding: "5px 10px", fontSize: 12, border: "1px solid #2563eb", borderRadius: 6, cursor: "pointer", background: "#eff6ff", color: "#2563eb", fontWeight: 600 },
  canvas: { padding: 8, flex: 1, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" },
  legend: { padding: "4px 16px 8px", fontSize: 11, color: "#9ca3af", textAlign: "center" as const, flexShrink: 0, background: "white", borderTop: "1px solid #f3f4f6" },
  saveStatus: { fontSize: 12, color: "#9ca3af" },
  undoBtn: { padding: "5px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", background: "white" },
  headerBtn: { padding: "5px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", background: "white" },
  saveBtn: { padding: "5px 12px", fontSize: 13, border: "none", borderRadius: 6, cursor: "pointer", background: "var(--c-primary)", color: "white", fontWeight: 600 },
};

export default function FormationEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { session, profile } = useAuthStore();
  useProfile(); // Lädt profile.tier in den AuthStore — nötig da diese Route außerhalb AppShell liegt
  const { allowed } = useFeatureGate("custom_formations");
  const isAdmin = profile?.role === "admin";

  const isEdit = !!id;

  // Cloud load when editing existing formation
  const { data: cloudFormation, isLoading: cloudLoading, isError: cloudError } = useCustomFormation(id);
  // Admin-Fallback: fremde Formation via SECURITY DEFINER RPC laden
  const needAdminFetch = isAdmin && isEdit && !cloudLoading && (cloudError || !cloudFormation);
  const { data: adminFormation, isLoading: adminLoading } = useAdminFormation(needAdminFetch ? id : undefined);
  const effectiveFormation = cloudFormation ?? adminFormation;

  const createMutation = useCreateCustomFormation();
  const updateMutation = useUpdateCustomFormation();
  const adminUpdateMutation = useAdminUpdateFormation();
  const duplicateMutation = useDuplicateCustomFormation();

  // Ist die Formation fremd (Admin greift per SECURITY DEFINER RPC zu)?
  const isAdminForeignFormation = needAdminFetch && !!adminFormation;

  const { data: permission, isLoading: permissionLoading } = useFormationPermission(isEdit ? id : undefined);
  // Admin darf fremde Formationen vollständig bearbeiten (via admin_update_custom_formation)
  const effectivePermission = (isAdmin && permission === null) ? "edit" : permission;
  const isReadOnly = isEdit && effectivePermission === "view";
  const isSharedEdit = isEdit && effectivePermission === "edit" && !isAdminForeignFormation;

  // edit-share users können speichern, auch wenn ihr eigener Tier free ist
  const isCloudMode = !!session && (allowed || isSharedEdit);

  // For new formations: start from localStorage draft (unless editing from cloud)
  const draft = !isEdit ? loadDraft() : null;
  const [initialized, setInitialized] = useState(isEdit ? false : true);
  const [showBasis, setShowBasis] = useState(!isEdit && !draft);

  const [tool, setTool] = useState<EditorTool>("select");
  const [selectedConeIds, setSelectedConeIds] = useState<string[]>([]);
  const [gateFirstConeId, setGateFirstConeId] = useState<string | null>(null);
  const [selectedArrowId, setSelectedArrowId] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementLine[]>([]);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);

  const [name, setName] = useState(draft?.name ?? "");
  const [description, setDescription] = useState(draft?.description ?? "");
  const [category, setCategory] = useState<FormationCategory>(draft?.category ?? "individuell");
  const [durationSeconds, setDurationSeconds] = useState<number | null>(draft?.durationSeconds ?? null);
  const [lichteBreite, setLichteBreite] = useState<number | null>(draft?.lichteBreite ?? null);
  const [sourceFormationKey, setSourceFormationKey] = useState<FormationKey | undefined>(draft?.sourceFormationKey);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [visibleM, setVisibleM] = useState(20);
  const [clipboard, setClipboard] = useState<EditableCone[]>([]);
  const [guides, setGuides] = useState<GuideLine[]>([]);

  const ZOOM_STEPS = [5, 8, 10, 12, 15, 20, 30];
  const zoomIdx = ZOOM_STEPS.indexOf(visibleM);
  const canZoomIn = zoomIdx > 0;
  const canZoomOut = zoomIdx < ZOOM_STEPS.length - 1;

  const { cones, arrows, snap, dispatch, canUndo, canRedo } = useFormationEditor(
    isEdit ? undefined : draft?.snap
  );

  // Initialize editor from cloud formation when loaded (or admin fallback)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!isEdit || !effectiveFormation || initializedRef.current) return;
    initializedRef.current = true;

    const raw = effectiveFormation.cones_json as ConePoint[];
    // Cones auf Ursprung normalisieren; Zentrieren auf Canvas-Mitte danach
    const norm = raw.length > 0 ? normalizeCones(raw) : raw;
    const normCentered = norm.length > 0
      ? (() => { const b = boundsFromCones(norm); return translateCones(norm, visibleM / 2 - b.cx, visibleM / 2 - b.cy); })()
      : norm;
    const cones = normCentered.map((c) => ({ ...c, id: crypto.randomUUID() }));

    // Auto-set zoom so all cones are visible with 2 m padding
    if (cones.length > 0) {
      const maxX = Math.max(...cones.map((c) => c.x));
      const maxY = Math.max(...cones.map((c) => c.y));
      const needed = Math.ceil(Math.max(maxX, maxY) + 2);
      const ZOOM_STEPS = [5, 8, 10, 12, 15, 20, 30];
      const fit = ZOOM_STEPS.find((s) => s >= needed) ?? 30;
      setVisibleM(fit);
    }

    dispatch({ type: "RESET", snap: { cones, arrows: effectiveFormation.arrows_json } });
    setName(effectiveFormation.name);
    setDescription(effectiveFormation.description ?? "");
    setCategory(effectiveFormation.category);
    setDurationSeconds(effectiveFormation.duration_seconds);
    setLichteBreite(effectiveFormation.lichte_breite);
    setInitialized(true);
  }, [effectiveFormation, isEdit, dispatch]);

  const saveToCloud = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!isCloudMode || !name.trim()) return;
    if (!silent) setSaveStatus("saving");
    try {
      const params = {
        name: name.trim(),
        description: description || null,
        category,
        cones_json: cones,
        arrows_json: arrows,
        default_direction: null,
        // 0 ist semantisch leer — RPC lehnt <= 0 ab
        lichte_breite: lichteBreite && lichteBreite > 0 ? lichteBreite : null,
        duration_seconds: durationSeconds && durationSeconds > 0 ? durationSeconds : null,
      };
      if (isEdit && id) {
        if (isAdminForeignFormation) {
          await adminUpdateMutation.mutateAsync({ id, ...params });
        } else {
          await updateMutation.mutateAsync({ id, ...params });
        }
      } else {
        const newId = await createMutation.mutateAsync({
          ...params,
          source_formation_key: sourceFormationKey ?? null,
          source_custom_formation_id: null,
        });
        clearDraft();
        navigate(`/formations/${newId}`, { replace: true });
        if (!silent) setSaveStatus("saved");
        return;
      }
      if (!silent) setSaveStatus("saved");
    } catch {
      if (!silent) setSaveStatus("error");
    }
    if (!silent) setTimeout(() => setSaveStatus("idle"), 2500);
  }, [isCloudMode, isEdit, id, isAdminForeignFormation, name, description, category, cones, arrows, lichteBreite, durationSeconds, sourceFormationKey, adminUpdateMutation, updateMutation, createMutation, navigate]);

  const saveToLocalStorage = useCallback(({ silent = false }: { silent?: boolean } = {}) => {
    const data: DraftData = { snap, name, description, category, durationSeconds, lichteBreite, sourceFormationKey };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    if (!silent) {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  }, [snap, name, description, category, durationSeconds, lichteBreite, sourceFormationKey]);

  const handleSave = isCloudMode ? () => saveToCloud() : () => saveToLocalStorage();

  async function handleDuplicate() {
    if (!id) return;
    try {
      const newId = await duplicateMutation.mutateAsync(id);
      navigate(`/formations/${newId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "PREMIUM_REQUIRED") alert("Eigene Hindernisse erfordern einen Pro-Tarif. Schreib uns: jens@polifka.info");
      else if (msg === "FORMATION_LIMIT_REACHED") alert("Du hast die maximale Anzahl eigener Hindernisse erreicht (100).");
      else alert("Hindernis konnte nicht dupliziert werden.");
    }
  }

  function handleReset() {
    clearDraft();
    setShowBasis(true);
    dispatch({ type: "RESET", snap: { cones: [], arrows: [] } });
    setName("");
    setDescription("");
    setCategory("individuell");
    setDurationSeconds(null);
    setLichteBreite(null);
    setSourceFormationKey(undefined);
    setMeasurements([]);
    setGuides([]);
    setSelectedConeIds([]);
    setSelectedArrowId(null);
    setSelectedMeasurementId(null);
    setGateFirstConeId(null);
    setClipboard([]);
  }

  // Autosave
  useEffect(() => {
    if (showBasis || !initialized || isReadOnly) return;
    const t = setTimeout(() => {
      if (isCloudMode) {
        if (isEdit) saveToCloud({ silent: true });
        // For new formations: only autosave to localStorage until first explicit save
        else saveToLocalStorage({ silent: true });
      } else {
        saveToLocalStorage({ silent: true });
      }
    }, 800);
    return () => clearTimeout(t);
  }, [snap, name, description, category, durationSeconds, lichteBreite, showBasis, initialized, isCloudMode, isEdit, saveToCloud, saveToLocalStorage]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault(); setTool("select"); setSelectedConeIds(cones.map((c) => c.id)); setSelectedArrowId(null);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "c") {
        // Kopieren
        if (selectedConeIds.length) setClipboard(cones.filter((c) => selectedConeIds.includes(c.id)));
      } else if ((e.metaKey || e.ctrlKey) && e.key === "v") {
        // Einfügen mit +1m Versatz
        if (clipboard.length) {
          const pasted: EditableCone[] = clipboard.map((c) => ({ ...c, id: crypto.randomUUID(), x: c.x + 1, y: c.y + 1 }));
          dispatch({ type: "ADD_CONES", cones: pasted });
          setSelectedConeIds(pasted.map((c) => c.id));
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        dispatch({ type: "UNDO" });
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        dispatch({ type: "REDO" });
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedConeIds.length) dispatch({ type: "DELETE_CONES", ids: selectedConeIds });
        if (selectedArrowId) dispatch({ type: "DELETE_ARROW", id: selectedArrowId });
        if (selectedMeasurementId) setMeasurements((ms) => ms.filter((m) => m.id !== selectedMeasurementId));
        setSelectedConeIds([]); setSelectedArrowId(null); setSelectedMeasurementId(null);
      } else if (e.key === "Escape") {
        setTool("select"); setSelectedConeIds([]); setSelectedMeasurementId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, selectedConeIds, selectedArrowId, selectedMeasurementId, cones, clipboard]);

  function handleBasisConfirm(initialSnap: EditorSnap, sourceKey?: FormationKey) {
    // Mathematisches Zentrum der Formation auf Canvas-Mitte legen
    const centered = initialSnap.cones.length > 0
      ? (() => {
          const b = boundsFromCones(initialSnap.cones);
          return translateCones(initialSnap.cones, visibleM / 2 - b.cx, visibleM / 2 - b.cy) as EditableCone[];
        })()
      : initialSnap.cones;
    dispatch({ type: "RESET", snap: { ...initialSnap, cones: centered } });
    setSourceFormationKey(sourceKey);
    setShowBasis(false);
  }

  function handleRotateSelected(angleDeg: number) {
    // Einzelcone: visuelle Ausrichtung des Pylons setzen
    if (selectedConeIds.length === 1) dispatch({ type: "UPDATE_CONE", id: selectedConeIds[0], patch: { angleDeg } });
  }

  function handleGatePairClick(id: string) {
    if (!gateFirstConeId) {
      setGateFirstConeId(id);
      return;
    }
    if (gateFirstConeId === id) {
      // Gleichen Cone nochmal → abwählen
      setGateFirstConeId(null);
      return;
    }
    // Zweiten Cone gewählt → Lichte Breite berechnen
    const c1 = cones.find((c) => c.id === gateFirstConeId);
    const c2 = cones.find((c) => c.id === id);
    if (c1 && c2) {
      const centerDist = Math.sqrt((c1.x - c2.x) ** 2 + (c1.y - c2.y) ** 2);
      const lb = Math.max(0, centerDist - PYLON_FOOT_SIZE);
      setLichteBreite(Math.round(lb * 1000) / 1000);
      // Sichtbare Maßlinie auf dem Canvas erstellen
      const mid: MeasurementLine = { id: crypto.randomUUID(), x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y };
      setMeasurements((ms) => [...ms, mid]);
      setSelectedMeasurementId(mid.id);
    }
    setGateFirstConeId(null);
    setTool("select");
  }

  function handleRotateSelection(deltaDeg: number) {
    // Mehrfachauswahl: Positionen um gemeinsamen Zentroid drehen
    if (selectedConeIds.length > 1) dispatch({ type: "ROTATE_SELECTION", ids: selectedConeIds, angleDeg: deltaDeg });
  }

  function handleDeleteSelected() {
    dispatch({ type: "DELETE_CONES", ids: selectedConeIds });
    setSelectedConeIds([]);
  }

  const selectedMeasurement = measurements.find((m) => m.id === selectedMeasurementId);
  const selDist = selectedMeasurement
    ? Math.sqrt((selectedMeasurement.x2 - selectedMeasurement.x1) ** 2 + (selectedMeasurement.y2 - selectedMeasurement.y1) ** 2)
    : null;

  const lichteBreiteWarning = lichteBreite !== null && lichteBreite < TASK_LANE_WIDTH;


  if (isEdit && (cloudLoading || permissionLoading || (needAdminFetch && adminLoading))) {
    return <div style={{ padding: 40, color: "#6b7280" }}>Lädt Hindernis…</div>;
  }
  if (isEdit && !permissionLoading && !isAdmin && permission === null) {
    return <div style={{ padding: 40, color: "#ef4444" }}>Kein Zugriff auf dieses Hindernis.</div>;
  }

  return (
    <div style={s.page}>
      {showBasis && <BasisAuswahl onConfirm={handleBasisConfirm} />}

      <header style={s.header}>
        <button style={s.headerBtn} onClick={() => { if (isEdit) navigate("/formations"); else navigate(-1); }}>← Zurück</button>
        <span style={s.title}>{name || (isEdit ? "Hindernis bearbeiten" : "Neues Hindernis")}</span>

        {isReadOnly && (
          <span style={{ fontSize: 11, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", padding: "3px 10px", borderRadius: 6, fontWeight: 600, flexShrink: 0 }}>
            Nur Ansicht
          </span>
        )}
        {isAdminForeignFormation && (
          <span style={{ fontSize: 11, background: "#fef3c7", border: "1px solid #fbbf24", color: "#92400e", padding: "3px 10px", borderRadius: 6, flexShrink: 0 }}>
            Admin-Bearbeitung
          </span>
        )}
        {isSharedEdit && (
          <span style={{ fontSize: 11, background: "#f0f9ff", border: "1px solid #bae6fd", color: "#0369a1", padding: "3px 10px", borderRadius: 6, flexShrink: 0 }}>
            Bearbeitungszugriff
          </span>
        )}

        {!isReadOnly && !isCloudMode && !isSharedEdit && (
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {session ? "Feature nicht freigeschaltet" : "Nicht eingeloggt"} — nur lokal
          </span>
        )}
        {!isEdit && (
          <button style={s.headerBtn} onClick={handleReset} title="Draft verwerfen und neu anfangen">
            Neu anfangen
          </button>
        )}

        {isReadOnly ? (
          <button
            style={{ ...s.saveBtn, background: "#3b82f6", opacity: duplicateMutation.isPending ? 0.6 : 1 }}
            onClick={handleDuplicate}
            disabled={duplicateMutation.isPending}
          >
            {duplicateMutation.isPending ? "Kopiere…" : "Als Kopie speichern"}
          </button>
        ) : (
          <button
            style={{ ...s.saveBtn, opacity: saveStatus === "saving" ? 0.6 : 1 }}
            onClick={handleSave}
            disabled={saveStatus === "saving" || !name.trim()}
            title={saveStatus === "saved" ? "Gespeichert ✓" : saveStatus === "error" ? "Fehler beim Speichern" : undefined}
          >
            {saveStatus === "saving" ? "Speichern…" : isCloudMode ? "In Cloud speichern" : "Lokal speichern"}
          </button>
        )}
      </header>

      <div style={s.body}>
        <div style={s.left}>
          <div style={{ ...s.toolbar, ...(isReadOnly ? { pointerEvents: "none", opacity: 0.4 } : {}) }}>
            {TOOLS.map((t) => (
              <button key={t} style={tool === t ? s.toolBtnActive : s.toolBtn} onClick={() => { const next = tool === t && t === "gatePair" ? "select" : t; setTool(next); if (next !== "gatePair") setGateFirstConeId(null); }} title={TOOL_LABELS[t]}>
                {TOOL_LABELS[t]}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            {tool === "gatePair" && (
              <span style={{ fontSize: 11, color: "#2563eb", marginRight: 8 }}>
                {gateFirstConeId ? "→ 2. Pylone anklicken" : "→ 1. Pylone anklicken"}
              </span>
            )}
            {(tool === "guideH" || tool === "guideV") && (
              <span style={{ fontSize: 11, color: "#3b82f6", marginRight: 8 }}>
                → Klicken zum Platzieren · Doppelklick auf Linie zum Löschen
              </span>
            )}
            <button style={{ ...s.undoBtn, opacity: canUndo ? 1 : 0.4 }} onClick={() => dispatch({ type: "UNDO" })} disabled={!canUndo}>↩ Undo</button>
            <button style={{ ...s.undoBtn, opacity: canRedo ? 1 : 0.4 }} onClick={() => dispatch({ type: "REDO" })} disabled={!canRedo}>↪ Redo</button>
            <div style={{ width: 1, background: "#e5e7eb", margin: "0 4px", alignSelf: "stretch" }} />
            <button style={{ ...s.undoBtn, opacity: canZoomIn ? 1 : 0.4 }} onClick={() => setVisibleM(ZOOM_STEPS[zoomIdx - 1])} disabled={!canZoomIn} title="Rein-zoomen">＋</button>
            <span style={{ fontSize: 11, color: "#6b7280", minWidth: 38, textAlign: "center" }}>{visibleM} m</span>
            <button style={{ ...s.undoBtn, opacity: canZoomOut ? 1 : 0.4 }} onClick={() => setVisibleM(ZOOM_STEPS[zoomIdx + 1])} disabled={!canZoomOut} title="Raus-zoomen">－</button>
          </div>

          <div style={s.canvas}>
            <FormationEditorCanvas
              cones={cones} arrows={arrows} measurements={measurements}
              selectedConeIds={selectedConeIds} selectedArrowId={selectedArrowId}
              selectedMeasurementId={selectedMeasurementId} tool={tool} visibleM={visibleM}
              dispatch={isReadOnly ? (() => {}) as typeof dispatch : dispatch}
              onSelectCones={isReadOnly ? () => {} : setSelectedConeIds}
              onSelectArrow={isReadOnly ? () => {} : setSelectedArrowId}
              onSelectMeasurement={setSelectedMeasurementId}
              onAddMeasurement={(m) => setMeasurements((ms) => [...ms, m])}
              onGatePairClick={handleGatePairClick}
              gatePairFirstId={gateFirstConeId}
              guides={guides}
              onAddGuide={(g) => setGuides((gs) => [...gs, g])}
              onRemoveGuide={(id) => setGuides((gs) => gs.filter((g) => g.id !== id))}
              onMoveGuide={(id, pos) => setGuides((gs) => gs.map((g) => g.id === id ? { ...g, pos } : g))}
            />
          </div>

          <div style={s.legend}>
            <span style={{ color: "#f59e0b", letterSpacing: 2 }}>━ ━</span>
            {" "}Pylone zu nah (&lt;&nbsp;0,50 m LB)
            <span style={{ marginLeft: 16, color: "#6b7280" }}>| ⇧ Hover: Snap auf 0 m / 0,50 m LB / 1,65 m LB | ⇧ Drag: Pylonen-Reihe | Cmd+C/V: Kopieren/Einfügen | Cmd+A: Alles</span>
            {selDist !== null ? (
              <span style={{ marginLeft: 16, color: "#3b82f6" }}>
                Maßlinie: <strong>{selDist.toFixed(2)} m</strong>
                {selDist < TASK_LANE_WIDTH ? " ⚠ zu schmal" : ""}
                <button style={{ marginLeft: 8, fontSize: 11, padding: "1px 6px", border: "1px solid #93c5fd", borderRadius: 4, cursor: "pointer", background: "white", color: "#2563eb" }}
                  onClick={() => setLichteBreite(Math.round(selDist * 100) / 100)}>
                  → Lichte Breite
                </button>
                <button style={{ marginLeft: 4, fontSize: 11, padding: "1px 6px", border: "1px solid #fca5a5", borderRadius: 4, cursor: "pointer", background: "white", color: "#dc2626" }}
                  onClick={() => { setMeasurements((ms) => ms.filter((m) => m.id !== selectedMeasurementId)); setSelectedMeasurementId(null); }}>
                  Löschen
                </button>
              </span>
            ) : measurements.length > 0 ? (
              <span style={{ marginLeft: 12, color: "#3b82f6" }}>
                {measurements.length} Maßlinie{measurements.length > 1 ? "n" : ""} — klicken zum Auswählen
              </span>
            ) : null}
            {lichteBreite !== null && (
              <span style={{ marginLeft: 16 }}>
                | Lichte Breite:{" "}
                <span style={{ color: lichteBreiteWarning ? "#ef4444" : "#22c55e", fontWeight: 600 }}>
                  {lichteBreite.toFixed(2)} m{lichteBreiteWarning ? " ⚠" : " ✓"}
                </span>
              </span>
            )}
          </div>
        </div>

        <FormationMetaPanel
          name={name} description={description} category={category}
          durationSeconds={durationSeconds} lichteBreite={lichteBreite}
          cones={cones} selectedConeIds={selectedConeIds}
          onChangeName={setName} onChangeDescription={setDescription}
          onChangeCategory={setCategory} onChangeDuration={setDurationSeconds}
          onChangeLichteBreite={setLichteBreite} onRotateSelectedCone={handleRotateSelected}
          onRotateSelection={handleRotateSelection}
          onDeleteSelected={handleDeleteSelected}
          guides={guides}
          onMoveGuide={(id, pos) => setGuides((gs) => gs.map((g) => g.id === id ? { ...g, pos } : g))}
          onRemoveGuide={(id) => setGuides((gs) => gs.filter((g) => g.id !== id))}
          onClearGuides={() => setGuides([])}
        />
      </div>
    </div>
  );
}
