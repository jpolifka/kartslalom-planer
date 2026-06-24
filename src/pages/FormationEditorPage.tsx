// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useFormationEditor, type EditorSnap } from "../hooks/useFormationEditor";
import FormationEditorCanvas, { type EditorTool, type MeasurementLine } from "../components/formation-editor/FormationEditorCanvas";
import FormationMetaPanel from "../components/formation-editor/FormationMetaPanel";
import BasisAuswahl from "../components/formation-editor/BasisAuswahl";
import type { FormationCategory, FormationKey } from "../types";
import { TASK_LANE_WIDTH } from "../lib/formations/common";

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
  } catch {
    return null;
  }
}

const TOOL_LABELS: Record<EditorTool, string> = {
  select: "Auswahl",
  standing: "Stehend",
  lying: "Liegend",
  sensor: "Sensor",
  arrow: "Pfeil",
  gatePair: "Breite messen",
};

const TOOLS: EditorTool[] = ["select", "standing", "lying", "sensor", "arrow", "gatePair"];

const s: Record<string, React.CSSProperties> = {
  page: { display: "flex", flexDirection: "column", height: "100vh", fontFamily: "system-ui, sans-serif", background: "#f9fafb" },
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
};

export default function FormationEditorPage() {
  const navigate = useNavigate();
  const draft = loadDraft();

  const [showBasis, setShowBasis] = useState(!draft);
  const [tool, setTool] = useState<EditorTool>("select");
  const [selectedConeIds, setSelectedConeIds] = useState<string[]>([]);
  const [selectedArrowId, setSelectedArrowId] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementLine[]>([]);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);

  const [name, setName] = useState(draft?.name ?? "");
  const [description, setDescription] = useState(draft?.description ?? "");
  const [category, setCategory] = useState<FormationCategory>(draft?.category ?? "individuell");
  const [durationSeconds, setDurationSeconds] = useState<number | null>(draft?.durationSeconds ?? null);
  const [lichteBreite, setLichteBreite] = useState<number | null>(draft?.lichteBreite ?? null);
  const [sourceFormationKey, setSourceFormationKey] = useState<FormationKey | undefined>(draft?.sourceFormationKey);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const [visibleM, setVisibleM] = useState(10);

  const ZOOM_STEPS = [5, 8, 10, 12, 15, 20, 30];
  const zoomIdx = ZOOM_STEPS.indexOf(visibleM);
  const canZoomIn = zoomIdx > 0;
  const canZoomOut = zoomIdx < ZOOM_STEPS.length - 1;

  const { cones, arrows, snap, dispatch, canUndo, canRedo } = useFormationEditor(draft?.snap);

  const saveDraft = useCallback(() => {
    const data: DraftData = { snap, name, description, category, durationSeconds, lichteBreite, sourceFormationKey };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  }, [snap, name, description, category, durationSeconds, lichteBreite, sourceFormationKey]);

  useEffect(() => {
    if (showBasis) return;
    const t = setTimeout(saveDraft, 800);
    return () => clearTimeout(t);
  }, [snap, name, description, category, durationSeconds, lichteBreite, saveDraft, showBasis]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        setTool("select");
        setSelectedConeIds(cones.map((c) => c.id));
        setSelectedArrowId(null);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        dispatch({ type: "UNDO" });
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        dispatch({ type: "REDO" });
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedConeIds.length) dispatch({ type: "DELETE_CONES", ids: selectedConeIds });
        if (selectedArrowId) dispatch({ type: "DELETE_ARROW", id: selectedArrowId });
        if (selectedMeasurementId) setMeasurements((ms) => ms.filter((m) => m.id !== selectedMeasurementId));
        setSelectedConeIds([]);
        setSelectedArrowId(null);
        setSelectedMeasurementId(null);
      } else if (e.key === "Escape") {
        setTool("select");
        setSelectedConeIds([]);
        setSelectedMeasurementId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, selectedConeIds, selectedArrowId, selectedMeasurementId, cones]);

  function handleBasisConfirm(initialSnap: EditorSnap, sourceKey?: FormationKey) {
    dispatch({ type: "RESET", snap: initialSnap });
    setSourceFormationKey(sourceKey);
    setShowBasis(false);
  }

  function handleToolClick(t: EditorTool) {
    setTool(tool === t && t === "gatePair" ? "select" : t);
  }

  function handleRotateSelected(angleDeg: number) {
    if (selectedConeIds.length === 1) {
      dispatch({ type: "UPDATE_CONE", id: selectedConeIds[0], patch: { angleDeg } });
    }
  }

  function handleDeleteSelected() {
    dispatch({ type: "DELETE_CONES", ids: selectedConeIds });
    setSelectedConeIds([]);
  }

  // Selected measurement distance for legend
  const selectedMeasurement = measurements.find((m) => m.id === selectedMeasurementId);
  const selDist = selectedMeasurement
    ? Math.sqrt((selectedMeasurement.x2 - selectedMeasurement.x1) ** 2 + (selectedMeasurement.y2 - selectedMeasurement.y1) ** 2)
    : null;

  const displaySourceKey = sourceFormationKey ? ` (Basis: ${sourceFormationKey})` : "";
  const lichteBreiteWarning = lichteBreite !== null && lichteBreite < TASK_LANE_WIDTH;

  return (
    <div style={s.page}>
      {showBasis && <BasisAuswahl onConfirm={handleBasisConfirm} />}

      <header style={s.header}>
        <button style={s.headerBtn} onClick={() => navigate(-1)}>← Zurück</button>
        <span style={s.title}>{name || "Neues Hindernis"}{displaySourceKey}</span>
        <span style={s.saveStatus}>{saveStatus === "saved" ? "Gespeichert ✓" : ""}</span>
        <button style={s.headerBtn} onClick={saveDraft}>Speichern</button>
      </header>

      <div style={s.body}>
        <div style={s.left}>
          <div style={s.toolbar}>
            {TOOLS.map((t) => (
              <button
                key={t}
                style={tool === t ? s.toolBtnActive : s.toolBtn}
                onClick={() => handleToolClick(t)}
                title={TOOL_LABELS[t]}
              >
                {TOOL_LABELS[t]}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            {tool === "gatePair" && (
              <span style={{ fontSize: 11, color: "#2563eb", marginRight: 8 }}>
                → Ziehen zum Messen
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
              cones={cones}
              arrows={arrows}
              measurements={measurements}
              selectedConeIds={selectedConeIds}
              selectedArrowId={selectedArrowId}
              selectedMeasurementId={selectedMeasurementId}
              tool={tool}
              visibleM={visibleM}
              dispatch={dispatch}
              onSelectCones={setSelectedConeIds}
              onSelectArrow={setSelectedArrowId}
              onSelectMeasurement={setSelectedMeasurementId}
              onAddMeasurement={(m) => setMeasurements((ms) => [...ms, m])}
              onGatePairClick={() => {}}
            />
          </div>

          <div style={s.legend}>
            <span style={{ color: "#f59e0b", letterSpacing: 2 }}>━ ━</span>
            {" "}Pylone zu nah (&lt;&nbsp;0,8 m)
            <span style={{ marginLeft: 16, color: "#6b7280" }}>| ⇧ Shift + Ziehen im Platzierungs-Modus = Pylonen-Reihe</span>
            {selDist !== null ? (
              <span style={{ marginLeft: 16, color: "#3b82f6" }}>
                Maßlinie: <strong>{selDist.toFixed(2)} m</strong>
                {selDist < TASK_LANE_WIDTH ? " ⚠ zu schmal" : ""}
                <button
                  style={{ marginLeft: 8, fontSize: 11, padding: "1px 6px", border: "1px solid #93c5fd", borderRadius: 4, cursor: "pointer", background: "white", color: "#2563eb" }}
                  onClick={() => setLichteBreite(Math.round(selDist * 100) / 100)}
                >
                  → Lichte Breite
                </button>
                <button
                  style={{ marginLeft: 4, fontSize: 11, padding: "1px 6px", border: "1px solid #fca5a5", borderRadius: 4, cursor: "pointer", background: "white", color: "#dc2626" }}
                  onClick={() => { setMeasurements((ms) => ms.filter((m) => m.id !== selectedMeasurementId)); setSelectedMeasurementId(null); }}
                >
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
          name={name}
          description={description}
          category={category}
          durationSeconds={durationSeconds}
          lichteBreite={lichteBreite}
          cones={cones}
          selectedConeIds={selectedConeIds}
          onChangeName={setName}
          onChangeDescription={setDescription}
          onChangeCategory={setCategory}
          onChangeDuration={setDurationSeconds}
          onChangeLichteBreite={setLichteBreite}
          onRotateSelectedCone={handleRotateSelected}
          onDeleteSelected={handleDeleteSelected}
        />
      </div>
    </div>
  );
}
