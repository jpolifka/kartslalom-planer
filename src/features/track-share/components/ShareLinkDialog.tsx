// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useState } from "react";
import { useCreateTrackShareLink, useRevokeTrackShareLink } from "../../../hooks/useTracks";

type Props = {
  isOpen: boolean;
  trackId: string;
  isPublic: boolean;
  onClose: () => void;
};

// Modal-mit-Backdrop-Muster analog zu SaveAsDialog.tsx.
// Der Plaintext-Token wird nur direkt nach dem Erzeugen angezeigt (lokaler
// State) — danach ist serverseitig nur noch der Hash bekannt, ein erneutes
// Öffnen des Dialogs kann den Link also nicht mehr im Klartext anzeigen.
export default function ShareLinkDialog({ isOpen, trackId, isPublic, onClose }: Props) {
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const createMutation = useCreateTrackShareLink(trackId);
  const revokeMutation = useRevokeTrackShareLink(trackId);

  if (!isOpen) return null;

  function handleClose() {
    setNewToken(null);
    setCopied(false);
    createMutation.reset();
    revokeMutation.reset();
    onClose();
  }

  function handleCreate() {
    setCopied(false);
    createMutation.mutate(undefined, {
      onSuccess: (token) => setNewToken(token),
    });
  }

  function handleRevoke() {
    revokeMutation.mutate(undefined, {
      onSuccess: () => setNewToken(null),
    });
  }

  const shareUrl = newToken ? `${window.location.origin}/share/${newToken}` : null;

  function handleCopy() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => setCopied(true));
  }

  const errorMessage =
    createMutation.error instanceof Error
      ? mapErrorMessage(createMutation.error.message)
      : revokeMutation.error instanceof Error
      ? mapErrorMessage(revokeMutation.error.message)
      : null;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={handleClose}
    >
      <div
        style={{ background: "white", borderRadius: 12, padding: 24, minWidth: 340, maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "#111827" }}>Strecke teilen</h2>
        <p style={{ fontSize: 13, color: "#374151", marginBottom: 14 }}>
          Wer den Link kennt, kann diese Strecke ohne Anmeldung als Nur-Lese-Ansicht öffnen.
          Es ist immer nur ein Link gleichzeitig aktiv — ein neu erzeugter Link ersetzt den alten.
        </p>

        {shareUrl ? (
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.target.select()}
              style={{ flex: 1, fontSize: 13, border: "1px solid #cbd5e1", borderRadius: 7, padding: "8px 10px", outline: "none", boxSizing: "border-box", color: "#374151" }}
            />
            <button
              onClick={handleCopy}
              style={{ padding: "8px 12px", borderRadius: 7, border: "1px solid #e2e8f0", background: "white", fontSize: 13, cursor: "pointer", color: "#374151", whiteSpace: "nowrap" }}
            >
              {copied ? "Kopiert ✓" : "Kopieren"}
            </button>
          </div>
        ) : isPublic ? (
          <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14, fontStyle: "italic" }}>
            Ein Link ist aktiv, kann aber aus Sicherheitsgründen nicht erneut angezeigt werden.
            "Neu erzeugen" ersetzt ihn durch einen neuen.
          </p>
        ) : null}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={handleClose}
            style={{ padding: "8px 16px", borderRadius: 7, border: "1px solid #e2e8f0", background: "white", fontSize: 13, cursor: "pointer", color: "#374151" }}
          >
            Schließen
          </button>
          {isPublic && (
            <button
              onClick={handleRevoke}
              disabled={revokeMutation.isPending}
              style={{ padding: "8px 16px", borderRadius: 7, border: "1px solid #fecaca", background: "white", fontSize: 13, cursor: "pointer", color: "#b91c1c" }}
            >
              {revokeMutation.isPending ? "Wird widerrufen…" : "Widerrufen"}
            </button>
          )}
          <button
            onClick={handleCreate}
            disabled={createMutation.isPending}
            style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: "var(--c-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "white" }}
          >
            {createMutation.isPending ? "Wird erzeugt…" : isPublic ? "Neu erzeugen" : "Link erstellen"}
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

function mapErrorMessage(code: string): string {
  switch (code) {
    case "SHARE_REQUIRES_PRO": return "Share-Links erfordern mindestens den Pro-Tarif.";
    case "NOT_OWNER":          return "Du bist nicht Eigentümer dieser Strecke.";
    case "ACCOUNT_DELETED":    return "Dein Account ist gelöscht.";
    default:                  return "Aktion fehlgeschlagen. Bitte versuche es erneut.";
  }
}
