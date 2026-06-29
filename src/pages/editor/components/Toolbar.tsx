// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import React, { useState, useRef, useEffect } from "react";
import {
  Trash2, AlertTriangle, Info, Pencil, Satellite,
  MousePointer, Undo2, Redo2, FileDown, Menu, SlidersHorizontal, ChevronDown,
} from "lucide-react";
import type { AreaSelection } from "../../../lib/areaSelection";
import { toolBtn, iconBtn, iconBtnLabel, divider, badge } from "../editorStyles";

type Props = {
  isMobile: boolean;
  mobilePanel: "formations" | "properties" | null;
  onSetMobilePanel: (p: "formations" | "properties" | null) => void;
  mode: "select" | "drawArrow";
  onSetMode: (m: "select" | "drawArrow") => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  areaSel: AreaSelection | null;
  onOpenMapSelector: () => void;
  errorCount: number;
  warnCount: number;
  hasItems: boolean;
  saveStatus: "idle" | "pending" | "saved";
  onExportSVG: () => void;
  onExportPDF: () => void;
  onExportJSON: () => void;
  onImportClick: () => void;
  onImportChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onReset: () => void;
};

function DownloadDropdown({ onExportSVG, onExportPDF, onExportJSON, onImportClick, onImportChange, fileInputRef }: {
  onExportSVG: () => void;
  onExportPDF: () => void;
  onExportJSON: () => void;
  onImportClick: () => void;
  onImportChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function pick(fn: () => void) { fn(); setOpen(false); }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ ...iconBtnLabel, gap: 4 }}
        title="Exportieren / Importieren"
      >
        <FileDown size={14} />
        <span>Download</span>
        <ChevronDown size={11} style={{ marginLeft: 1, opacity: 0.6 }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
          background: "white", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.13)",
          border: "1px solid #e2e8f0", minWidth: 150, overflow: "hidden",
        }}>
          {[
            { label: "Als SVG", fn: () => pick(onExportSVG) },
            { label: "Als PDF", fn: () => pick(onExportPDF) },
            { label: "Als JSON", fn: () => pick(onExportJSON) },
          ].map(({ label, fn }) => (
            <button key={label} onClick={fn} style={{
              display: "block", width: "100%", textAlign: "left", padding: "9px 14px",
              fontSize: 13, border: "none", background: "none", cursor: "pointer", color: "#374151",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              {label}
            </button>
          ))}
          <div style={{ borderTop: "1px solid #f1f5f9" }} />
          <button onClick={() => { pick(onImportClick); }} style={{
            display: "block", width: "100%", textAlign: "left", padding: "9px 14px",
            fontSize: 13, border: "none", background: "none", cursor: "pointer", color: "#374151",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            Aus JSON laden
          </button>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={onImportChange}
      />
    </div>
  );
}

export default function Toolbar({
  isMobile, mobilePanel, onSetMobilePanel,
  mode, onSetMode,
  canUndo, canRedo, onUndo, onRedo,
  areaSel, onOpenMapSelector,
  errorCount, warnCount, hasItems,
  saveStatus,
  onExportSVG, onExportPDF, onExportJSON, onImportClick, onImportChange, fileInputRef,
  onReset,
}: Props) {
  return (
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
            onClick={() => onSetMobilePanel(mobilePanel === "formations" ? null : "formations")}
            style={toolBtn(mobilePanel === "formations")}
            title="Formationen ein-/ausblenden"
          >
            <Menu size={14} />
            <span>Formationen</span>
          </button>
          <button
            onClick={() => onSetMobilePanel(mobilePanel === "properties" ? null : "properties")}
            style={toolBtn(mobilePanel === "properties")}
            title="Eigenschaften ein-/ausblenden"
          >
            <SlidersHorizontal size={14} />
            <span>Eigenschaften</span>
          </button>
          <div style={divider} />
        </>
      )}

      <button onClick={() => onSetMode("select")} style={toolBtn(mode === "select")} title="Auswählen (Esc)">
        <MousePointer size={14} />
        <span>Auswählen</span>
      </button>
      <button onClick={() => onSetMode("drawArrow")} style={toolBtn(mode === "drawArrow")} title="Pfeil zeichnen">
        <Pencil size={14} />
        <span>Pfeil</span>
      </button>

      <div style={divider} />

      <button onClick={onUndo} disabled={!canUndo} style={iconBtn(!canUndo)} title="Rückgängig (⌘Z)">
        <Undo2 size={14} />
      </button>
      <button onClick={onRedo} disabled={!canRedo} style={iconBtn(!canRedo)} title="Wiederherstellen (⌘⇧Z)">
        <Redo2 size={14} />
      </button>

      <div style={divider} />

      <button
        onClick={onOpenMapSelector}
        style={{ ...iconBtnLabel, borderColor: areaSel ? "var(--c-primary)" : "#cbd5e1", color: areaSel ? "var(--c-primary)" : "#475569" }}
        title="Streckenbereich auf Karte auswählen / zoomen"
      >
        <Satellite size={14} />
        <span>{areaSel ? "Karte" : "Karte wählen"}</span>
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
      {errorCount === 0 && warnCount === 0 && hasItems && (
        <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>✓</span>
      )}

      <div style={divider} />

      <DownloadDropdown
        onExportSVG={onExportSVG}
        onExportPDF={onExportPDF}
        onExportJSON={onExportJSON}
        onImportClick={onImportClick}
        onImportChange={onImportChange}
        fileInputRef={fileInputRef}
      />

      {saveStatus !== "idle" && (
        <span style={{ fontSize: 12, color: saveStatus === "saved" ? "#16a34a" : "#94a3b8", transition: "color 0.3s" }}>
          {saveStatus === "saved" ? "✓" : "…"}
        </span>
      )}

      <div style={divider} />

      <button
        onClick={onReset}
        style={{ ...iconBtn(false), color: "#b91c1c", borderColor: "#fecaca" }}
        title="Neu beginnen"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
