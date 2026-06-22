// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useFormationEditor, type EditorSnap } from "../hooks/useFormationEditor";
import FormationEditorCanvas, { type EditorTool } from "../components/formation-editor/FormationEditorCanvas";
import FormationMetaPanel from "../components/formation-editor/FormationMetaPanel";
import GatePairTool from "../components/formation-editor/GatePairTool";
import BasisAuswahl from "../components/formation-editor/BasisAuswahl";
import type { FormationCategory, FormationKey } from "../types";

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
  gatePair: "Tor",
};

const TOOLS: EditorTool[] = ["select", "standing", "lying", "sensor", "arrow", "gatePair"];

const s: Record<string, React.CSSProperties> = {
  page: { display: "flex", flexDirection: "column", height: "100vh", fontFamily: "system-ui, sans-serif", background: "#f9fafb" },
  header: { display: "flex", alignItems: "center", gap: 12, padding: "0 16px", height: 52, background: "white", borderBottom: "1px solid #e5e7eb", flexShrink: 0 },
  title: { fontSize: 15, fontWeight: 700, color: "#111827", flex: 1 },
  body: { display: "flex", flex: 1, overflow: "hidden" },
  left: { display: "flex", flexDirection: "column", flexShrink: 0 },
  toolbar: { display: "flex", gap: 4, padding: "8px 12px", background: "white", borderBottom: "1px solid #e5e7eb", flexWrap: "wrap" as const },
  toolBtn: { padding: "5px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", background: "white" },
  toolBtnActive: { padding: "5px 10px", fontSize: 12, border: "1px solid #2563eb", borderRadius: 6, cursor: "pointer", background: "#eff6ff", color: "#2563eb", fontWeight: 600 },
  canvas: { padding: 16, flex: 1, overflow: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center" },
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
  const [gatePairIds, setGatePairIds] = useState<[string, string] | null>(null);
  const [gatePairActive, setGatePairActive] = useState(false);
  const [gatePairPending, setGatePairPending] = useState<string | null>(null);

  const [name, setName] = useState(draft?.name ?? "");
  const [description, setDescription] = useState(draft?.description ?? "");
  const [category, setCategory] = useState<FormationCategory>(draft?.category ?? "individuell");
  const [durationSeconds, setDurationSeconds] = useState<number | null>(draft?.durationSeconds ?? null);
  const [lichteBreite, setLichteBreite] = useState<number | null>(draft?.lichteBreite ?? null);
  const [sourceFormationKey, setSourceFormationKey] = useState<FormationKey | undefined>(draft?.sourceFormationKey);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");

  const { cones, arrows, snap, dispatch, canUndo, canRedo } = useFormationEditor(draft?.snap);

  const saveDraft = useCallback(() => {
    const data: DraftData = { snap, name, description, category, durationSeconds, lichteBreite, sourceFormationKey };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  }, [snap, name, description, category, durationSeconds, lichteBreite, sourceFormationKey]);

  // Autosave on changes
  useEffect(() => {
    if (showBasis) return;
    const t = setTimeout(saveDraft, 800);
    return () => clearTimeout(t);
  }, [snap, name, description, category, durationSeconds, lichteBreite, saveDraft, showBasis]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        dispatch({ type: "UNDO" });
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        dispatch({ type: "REDO" });
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedConeIds.length) dispatch({ type: "DELETE_CONES", ids: selectedConeIds });
        if (selectedArrowId) dispatch({ type: "DELETE_ARROW", id: selectedArrowId });
        setSelectedConeIds([]);
        setSelectedArrowId(null);
      } else if (e.key === "Escape") {
        setTool("select");
        setGatePairActive(false);
        setGatePairPending(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, selectedConeIds, selectedArrowId]);

  function handleBasisConfirm(initialSnap: EditorSnap, sourceKey?: FormationKey) {
    dispatch({ type: "RESET", snap: initialSnap });
    setSourceFormationKey(sourceKey);
    setShowBasis(false);
  }

  function handleGatePairClick(coneId: string) {
    if (!gatePairPending) {
      setGatePairPending(coneId);
    } else if (gatePairPending !== coneId) {
      setGatePairIds([gatePairPending, coneId]);
      setGatePairPending(null);
      setGatePairActive(false);
      setTool("select");
    }
  }

  function handleActivateGatePair() {
    setTool("gatePair");
    setGatePairActive(true);
    setGatePairIds(null);
    setGatePairPending(null);
  }

  function handleClearGatePair() {
    setGatePairActive(false);
    setGatePairIds(null);
    setGatePairPending(null);
    if (tool === "gatePair") setTool("select");
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

  const displaySourceKey = sourceFormationKey ? ` (Basis: ${sourceFormationKey})` : "";

  return (
    <div style={s.page}>
      {showBasis && <BasisAuswahl onConfirm={handleBasisConfirm} />}

      <header style={s.header}>
        <button style={s.headerBtn} onClick={() => navigate(-1)}>← Zurück</button>
        <span style={s.title}>
          {name || "Neues Hindernis"}{displaySourceKey}
        </span>
        <span style={s.saveStatus}>
          {saveStatus === "saved" ? "Gespeichert ✓" : ""}
        </span>
        <button style={s.headerBtn} onClick={saveDraft}>Speichern</button>
      </header>

      <div style={s.body}>
        <div style={s.left}>
          <div style={s.toolbar}>
            {TOOLS.map((t) => (
              <button
                key={t}
                style={tool === t ? s.toolBtnActive : s.toolBtn}
                onClick={() => { setTool(t); if (t !== "gatePair") { setGatePairActive(false); setGatePairPending(null); } }}
                title={TOOL_LABELS[t]}
              >
                {TOOL_LABELS[t]}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button style={{ ...s.undoBtn, opacity: canUndo ? 1 : 0.4 }} onClick={() => dispatch({ type: "UNDO" })} disabled={!canUndo}>↩ Undo</button>
            <button style={{ ...s.undoBtn, opacity: canRedo ? 1 : 0.4 }} onClick={() => dispatch({ type: "REDO" })} disabled={!canRedo}>↪ Redo</button>
          </div>

          <GatePairTool
            cones={cones}
            gatePairIds={gatePairIds}
            active={gatePairActive}
            onActivate={handleActivateGatePair}
            onClear={handleClearGatePair}
            onApplyLichteBreite={setLichteBreite}
          />

          <div style={s.canvas}>
            <FormationEditorCanvas
              cones={cones}
              arrows={arrows}
              selectedConeIds={selectedConeIds}
              selectedArrowId={selectedArrowId}
              tool={tool}
              gatePairIds={gatePairIds}
              dispatch={dispatch}
              onSelectCones={setSelectedConeIds}
              onSelectArrow={setSelectedArrowId}
              onGatePairClick={handleGatePairClick}
            />
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
