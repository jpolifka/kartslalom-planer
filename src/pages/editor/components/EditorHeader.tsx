// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import React from "react";
import { Link } from "react-router-dom";
import { HelpCircle, LayoutDashboard, LogIn, LogOut, Pencil } from "lucide-react";
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
  onSignOut: () => void;
};

export default function EditorHeader({
  isMobile, isCloudMode, trackId,
  trackName, nameFocused,
  onSetTrackName, onNameFocus, onNameBlur, onNameKeyDown,
  onShowHelp, onSignOut,
}: Props) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isCloudMode && trackId ? 4 : (isMobile ? 8 : 16), flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 17 : 21, fontWeight: 800 }}>
          Kartslalom Streckenplaner
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a
            href="/impressum"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#64748b", fontSize: 12, textDecoration: "underline", padding: 4, whiteSpace: "nowrap" }}
            title="Impressum / Datenschutzerklärung öffnen"
          >
            {isMobile ? "Impressum" : "Impressum / Datenschutzerklärung"}
          </a>
          <button
            onClick={onShowHelp}
            style={{ ...iconBtnLabel, color: "var(--c-primary)", borderColor: "var(--c-primary-border)" }}
            title="Hilfe öffnen"
          >
            <HelpCircle size={14} />
            <span>Hilfe</span>
          </button>
          {isCloudMode ? (
            <>
              <Link to="/dashboard" style={{ ...iconBtnLabel, textDecoration: "none" }} title="Zurück zu meinen Strecken">
                <LayoutDashboard size={14} />
                {!isMobile && <span>Meine Strecken</span>}
              </Link>
              <button
                onClick={onSignOut}
                style={{ ...iconBtnLabel, color: "#b91c1c", borderColor: "#fecaca" }}
                title="Abmelden"
              >
                <LogOut size={14} />
                {!isMobile && <span>Abmelden</span>}
              </button>
            </>
          ) : (
            <Link to="/login" style={{ ...iconBtnLabel, textDecoration: "none" }} title="Anmelden, um Strecken in der Cloud zu speichern">
              <LogIn size={14} />
              {!isMobile && <span>Anmelden</span>}
            </Link>
          )}
        </div>
      </div>

      {isCloudMode && trackId && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isMobile ? 8 : 12, flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", flexShrink: 0 }}>
            Streckenname:
          </span>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: nameFocused ? "white" : "#f1f5f9",
            border: nameFocused ? "2px solid var(--c-primary)" : "2px solid #e2e8f0",
            borderRadius: 8, padding: "3px 8px",
            transition: "border-color 0.15s, background 0.15s",
            boxShadow: nameFocused ? "0 0 0 3px #b8d98a" : "none",
          }}>
            <Pencil size={12} color={nameFocused ? "var(--c-primary)" : "#94a3b8"} style={{ flexShrink: 0 }} />
            <input
              value={trackName}
              onChange={(e) => onSetTrackName(e.target.value)}
              onFocus={onNameFocus}
              onBlur={onNameBlur}
              onKeyDown={onNameKeyDown}
              style={{
                fontSize: isMobile ? 13 : 14,
                fontWeight: 700,
                color: "#0f172a",
                border: "none",
                background: "transparent",
                padding: 0,
                outline: "none",
                minWidth: 140,
                maxWidth: 320,
              }}
              title="Streckenname bearbeiten (Enter zum Bestätigen, Esc zum Abbrechen)"
              aria-label="Streckenname"
            />
          </div>
        </div>
      )}
    </>
  );
}
