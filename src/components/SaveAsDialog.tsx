// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useEffect, useRef, useState } from "react";

type Props = {
  isOpen: boolean;
  initialName: string;
  isPending?: boolean;
  errorMessage?: string | null;
  onConfirm: (name: string) => void;
  onCancel: () => void;
};

// "Speichern unter" — Namensabfrage für einen neuen Track aus einem Snapshot.
// Modal-mit-Backdrop-Muster analog zu AdminTracksPage.tsx (Lösch-Dialog),
// da es an zwei Stellen (Dashboard + Editor-Vorschau-Banner) verwendet wird.
export default function SaveAsDialog({ isOpen, initialName, isPending, errorMessage, onConfirm, onCancel }: Props) {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Bei jedem Öffnen den vorbelegten Namen übernehmen und komplett markieren,
  // damit der Nutzer sofort lostippen kann.
  useEffect(() => {
    if (!isOpen) return;
    setName(initialName);
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  function handleConfirm() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={onCancel}
    >
      <div
        style={{ background: "white", borderRadius: 12, padding: 24, minWidth: 340, maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "#111827" }}>Als neue Strecke speichern</h2>
        <p style={{ fontSize: 13, color: "#374151", marginBottom: 14 }}>
          Dieser Snapshot wird als eigenständige, neue Strecke angelegt. Die ursprüngliche Strecke bleibt unverändert.
        </p>
        <input
          ref={inputRef}
          aria-label="Name der neuen Strecke"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConfirm();
            if (e.key === "Escape") onCancel();
          }}
          style={{ width: "100%", fontSize: 14, fontWeight: 600, border: "1px solid #cbd5e1", borderRadius: 7, padding: "8px 10px", outline: "none", boxSizing: "border-box", marginBottom: 20 }}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{ padding: "8px 16px", borderRadius: 7, border: "1px solid #e2e8f0", background: "white", fontSize: 13, cursor: "pointer", color: "#374151" }}
          >
            Abbrechen
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending || !name.trim()}
            style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: "var(--c-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "white" }}
          >
            {isPending ? "Wird gespeichert…" : "Speichern"}
          </button>
        </div>
        {errorMessage && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#b91c1c", background: "#fee2e2", borderRadius: 6, padding: "8px 12px" }}>
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}
