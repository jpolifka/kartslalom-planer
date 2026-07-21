// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useState } from "react";
import { useLocation } from "react-router-dom";

const FEEDBACK_EMAIL = "jens@polifka.info";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 };
const textarea: React.CSSProperties = {
  width: "100%", fontSize: 13, border: "1px solid #cbd5e1", borderRadius: 7, padding: "8px 10px",
  outline: "none", boxSizing: "border-box", resize: "vertical", minHeight: 52, fontFamily: "inherit",
};

// Feedback-Weg für die Pilotphase: baut aus den Antworten einen mailto:-Link,
// versendet also nichts selbst und übermittelt bewusst keine Streckendaten —
// nur Seite + App-Version als technischer Kontext.
export default function FeedbackDialog({ isOpen, onClose }: Props) {
  const location = useLocation();
  const [wanted, setWanted] = useState("");
  const [broken, setBroken] = useState("");
  const [unclear, setUnclear] = useState("");
  const [expected, setExpected] = useState("");
  const [contactOk, setContactOk] = useState(false);
  const [contactEmail, setContactEmail] = useState("");

  if (!isOpen) return null;

  function handleSend() {
    const lines = [
      `Seite: ${location.pathname}`,
      // __APP_VERSION__ wird zur Build-Zeit von Vite eingesetzt (siehe vite.config.ts /
      // vite-env.d.ts) — kein Laufzeit-Import, daher taucht die Konstante hier ohne
      // Import auf.
      `App-Version: ${__APP_VERSION__}`,
      "",
      `Was wolltest du machen?\n${wanted || "-"}`,
      "",
      `Was hat nicht funktioniert?\n${broken || "-"}`,
      "",
      `Was war unklar?\n${unclear || "-"}`,
      "",
      `Was hast du erwartet?\n${expected || "-"}`,
      "",
      contactOk
        ? `Rückfrage erwünscht, Kontakt: ${contactEmail || "(E-Mail-Absender verwenden)"}`
        : "Keine Rückfrage erwünscht.",
    ];
    const subject = encodeURIComponent("Feedback: Kartslalom Streckenplaner");
    const body = encodeURIComponent(lines.join("\n"));
    window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
    onClose();
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: "white", borderRadius: 12, padding: 24, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#111827" }}>Feedback geben</h2>
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
          Öffnet dein E-Mail-Programm mit einem vorbereiteten Entwurf. Es werden keine
          Streckendaten mitgesendet.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={label}>Was wolltest du machen?</label>
            <textarea style={textarea} value={wanted} onChange={(e) => setWanted(e.target.value)} />
          </div>
          <div>
            <label style={label}>Was hat nicht funktioniert?</label>
            <textarea style={textarea} value={broken} onChange={(e) => setBroken(e.target.value)} />
          </div>
          <div>
            <label style={label}>Was war unklar?</label>
            <textarea style={textarea} value={unclear} onChange={(e) => setUnclear(e.target.value)} />
          </div>
          <div>
            <label style={label}>Was hast du erwartet?</label>
            <textarea style={textarea} value={expected} onChange={(e) => setExpected(e.target.value)} />
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151", marginBottom: contactOk ? 8 : 0 }}>
          <input type="checkbox" checked={contactOk} onChange={(e) => setContactOk(e.target.checked)} />
          Darf ich dich dazu kontaktieren?
        </label>
        {contactOk && (
          <input
            type="email"
            placeholder="Deine E-Mail-Adresse (optional)"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            style={{ width: "100%", fontSize: 13, border: "1px solid #cbd5e1", borderRadius: 7, padding: "8px 10px", outline: "none", boxSizing: "border-box", marginBottom: 8 }}
          />
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 16px", borderRadius: 7, border: "1px solid #e2e8f0", background: "white", fontSize: 13, cursor: "pointer", color: "#374151" }}
          >
            Abbrechen
          </button>
          <button
            onClick={handleSend}
            style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: "var(--c-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "white" }}
          >
            Feedback senden
          </button>
        </div>
      </div>
    </div>
  );
}
