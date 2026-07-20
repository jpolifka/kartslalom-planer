// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import React from "react";
import { X, HelpCircle } from "lucide-react";

type Props = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

// Generische Modal-Chrome für die Hilfe — bewusst inhaltsfrei (nimmt nur
// `children`), damit GlobalNav hier je nach aktueller Route unterschiedlichen
// Inhalt (TrackHelpContent vs. FormationHelpContent) einsetzen kann, ohne die
// Fenster-Optik (Backdrop, Card, Titel, Schließen-Button) zu duplizieren.
export default function HelpModal({ title, onClose, children }: Props) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box" }}
      onClick={onClose}
    >
      <div
        style={{ background: "white", borderRadius: 20, padding: 22, width: "min(720px, 96vw)", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.35)", boxSizing: "border-box" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <HelpCircle size={20} color="var(--c-primary)" /> {title}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", padding: 4 }} title="Schließen">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
