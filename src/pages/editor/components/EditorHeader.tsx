// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import React from "react";
import { HelpCircle, Pencil } from "lucide-react";
import { iconBtnLabel } from "../editorStyles";

type Props = {
  isMobile: boolean;
  isCloudMode: boolean;
  trackId: string | null;
  trackName: string;
  nameFocused: boolean;
  onSetTrackName: (name: string) => void;
  onNameFocus: () => void;
  onNameBlur: () => void;
  onNameKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onShowHelp: () => void;
};

export default function EditorHeader({
  isMobile, isCloudMode, trackId,
  trackName, nameFocused,
  onSetTrackName, onNameFocus, onNameBlur, onNameKeyDown,
  onShowHelp,
}: Props) {
  if (!isCloudMode || !trackId) {
    // Gast-Modus: nur Hilfe-Button
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: isMobile ? 8 : 12, flexShrink: 0 }}>
        <button onClick={onShowHelp} style={{ ...iconBtnLabel, color: "var(--c-primary)", borderColor: "var(--c-primary-border)" }} title="Hilfe öffnen">
          <HelpCircle size={14} /><span>Hilfe</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isMobile ? 8 : 12, flexShrink: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", flexShrink: 0 }}>
        Strecke:
      </span>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        background: nameFocused ? "white" : "#f1f5f9",
        border: nameFocused ? "2px solid var(--c-primary)" : "2px solid #e2e8f0",
        borderRadius: 8, padding: "3px 8px",
        transition: "border-color 0.15s, background 0.15s",
        boxShadow: nameFocused ? "0 0 0 3px var(--c-primary-border)" : "none",
        flex: 1, maxWidth: 360,
      }}>
        <Pencil size={12} color={nameFocused ? "var(--c-primary)" : "#94a3b8"} style={{ flexShrink: 0 }} />
        <input
          value={trackName}
          onChange={(e) => onSetTrackName(e.target.value)}
          onFocus={onNameFocus}
          onBlur={onNameBlur}
          onKeyDown={onNameKeyDown}
          style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: "#0f172a", border: "none", background: "transparent", padding: 0, outline: "none", minWidth: 140, width: "100%" }}
          title="Streckenname bearbeiten (Enter zum Bestätigen, Esc zum Abbrechen)"
          aria-label="Streckenname"
        />
      </div>
      <button onClick={onShowHelp} style={{ ...iconBtnLabel, color: "var(--c-primary)", borderColor: "var(--c-primary-border)" }} title="Hilfe öffnen">
        <HelpCircle size={14} />{!isMobile && <span>Hilfe</span>}
      </button>
    </div>
  );
}
