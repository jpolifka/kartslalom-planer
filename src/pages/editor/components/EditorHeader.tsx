// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import React from "react";
import { Pencil, Share2 } from "lucide-react";
import { iconBtnLabel } from "../editorStyles";

type Props = {
  isMobile: boolean;
  isCloudMode: boolean;
  trackId: string | null;
  trackName: string;
  nameFocused: boolean;
  nameReadOnly?: boolean;
  onSetTrackName: (name: string) => void;
  onNameFocus: () => void;
  onNameBlur: () => void;
  onNameKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  shareLocked?: boolean;
  onOpenShare?: () => void;
};

// Zeigt/bearbeitet den Streckennamen und bietet den Teilen-Button — nur im
// Cloud-Modus für eine bereits existierende Strecke (Gast-Strecken haben
// keinen Cloud-Namen zum Bearbeiten und keinen Share-Link).
export default function EditorHeader({
  isMobile, isCloudMode, trackId,
  trackName, nameFocused, nameReadOnly,
  onSetTrackName, onNameFocus, onNameBlur, onNameKeyDown,
  shareLocked, onOpenShare,
}: Props) {
  if (!isCloudMode || !trackId) {
    // Gast-Modus: kein zusätzlicher Header-Inhalt (Hilfe sitzt im globalen Nav)
    return null;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isMobile ? 8 : 12, flexShrink: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", flexShrink: 0 }}>
        Strecke:
      </span>
      {/* nameReadOnly = ein Admin betrachtet eine FREMDE Strecke (RLS würde
          normalen Nutzern hier gar keine Daten liefern) — Umbenennen bliebe
          serverseitig ohnehin blockiert, daher hier direkt als reiner Text
          statt editierbarem Input dargestellt. */}
      {nameReadOnly ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "#f1f5f9", border: "2px solid #e2e8f0",
          borderRadius: 8, padding: "3px 8px", flex: 1, maxWidth: 360,
        }}>
          <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: "#64748b", minWidth: 140 }}>
            {trackName}
          </span>
          <span style={{ fontSize: 10, color: "#94a3b8", flexShrink: 0, fontStyle: "italic" }}>
            (Admin – nur Lesen)
          </span>
        </div>
      ) : (
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
      )}
      {onOpenShare && !nameReadOnly && (
        <button
          onClick={onOpenShare}
          disabled={shareLocked}
          style={{ ...iconBtnLabel, color: shareLocked ? "#94a3b8" : "#374151", cursor: shareLocked ? "default" : "pointer" }}
          title={shareLocked ? "Strecke teilen erfordert mindestens den Pro-Tarif" : "Strecke teilen"}
        >
          <Share2 size={14} />{!isMobile && <span>Teilen{shareLocked && " (Pro)"}</span>}
        </button>
      )}
    </div>
  );
}
