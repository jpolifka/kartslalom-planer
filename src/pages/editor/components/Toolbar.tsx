// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import React from "react";
import {
  Trash2, AlertTriangle, Info, Pencil, Satellite,
  MousePointer, Undo2, Redo2, FileDown, Menu, SlidersHorizontal,
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
  fieldWidth: number;
  fieldLength: number;
  saveStatus: "idle" | "pending" | "saved";
  onExportSVG: () => void;
  onExportPDF: () => void;
  onExportJSON: () => void;
  onImportClick: () => void;
  onImportChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onReset: () => void;
};

export default function Toolbar({
  isMobile, mobilePanel, onSetMobilePanel,
  mode, onSetMode,
  canUndo, canRedo, onUndo, onRedo,
  areaSel, onOpenMapSelector,
  errorCount, warnCount, hasItems,
  fieldWidth, fieldLength,
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
        style={{ ...iconBtnLabel, borderColor: areaSel ? "#2F6C40" : "#cbd5e1", color: areaSel ? "#2F6C40" : "#475569" }}
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
      {errorCount === 0 && warnCount === 0 && hasItems && (
        <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>✓ Alles OK</span>
      )}

      <div style={divider} />

      <button onClick={onExportSVG} style={iconBtnLabel} title="Als SVG herunterladen">
        <FileDown size={14} />
        <span>SVG</span>
      </button>
      <button onClick={onExportPDF} style={iconBtnLabel} title="Als PDF drucken">
        <FileDown size={14} />
        <span>PDF</span>
      </button>
      <button onClick={onExportJSON} style={iconBtnLabel} title="Strecke als JSON-Datei speichern">
        <FileDown size={14} />
        <span>JSON</span>
      </button>
      <button onClick={onImportClick} style={iconBtnLabel} title="Strecke aus JSON-Datei laden">
        <FileDown size={14} style={{ transform: "rotate(180deg)" }} />
        <span>Laden</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={onImportChange}
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
        onClick={onReset}
        style={{ ...iconBtnLabel, color: "#b91c1c", borderColor: "#fecaca" }}
        title="Neu beginnen"
      >
        <Trash2 size={14} />
        <span>Neu</span>
      </button>
    </div>
  );
}
