// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useSetDisplayName } from "../hooks/useCustomFormations";
import { supabase, functionsUrl } from "../lib/supabase";

export default function SettingsPage() {
  const { session, profile } = useAuthStore();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Anzeigename
  const [displayNameInput, setDisplayNameInput] = useState(profile?.display_name ?? "");
  const [displayNameSuccess, setDisplayNameSuccess] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const setDisplayNameMutation = useSetDisplayName();

  async function handleSaveDisplayName() {
    setDisplayNameError(null);
    setDisplayNameSuccess(false);
    const value = displayNameInput.trim() || null;
    try {
      await setDisplayNameMutation.mutateAsync(value);
      setDisplayNameSuccess(true);
    } catch (e) {
      if (e instanceof Error && e.message === "INVALID_DISPLAY_NAME") {
        setDisplayNameError("Anzeigename muss 2–40 Zeichen lang sein (oder leer lassen).");
      } else {
        setDisplayNameError("Speichern fehlgeschlagen.");
      }
    }
  }

  async function handleExport() {
    if (!session) return;
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(functionsUrl("account-export"), {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`Export fehlgeschlagen (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kartslalom-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export fehlgeschlagen");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (!session) return;
    const confirmed = window.confirm(
      "Account wirklich löschen?\n\nAlle Strecken und Daten werden unwiderruflich gelöscht."
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(functionsUrl("delete-account"), {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`Löschen fehlgeschlagen (${res.status})`);
      await supabase.auth.signOut();
      navigate("/editor/new", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Löschen fehlgeschlagen");
      setDeleting(false);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 20px" }}>
      <h2 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 800 }}>Einstellungen</h2>

      <section style={{
        background: "white", borderRadius: 16, padding: 18,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginBottom: 14,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", marginBottom: 10 }}>
          Account
        </div>
        <div style={{ fontSize: 14, marginBottom: 4 }}>{session?.user.email}</div>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          Tarif: {profile?.tier ?? "free"}
        </div>
      </section>

      <section style={{
        background: "white", borderRadius: 16, padding: 18,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginBottom: 14,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", marginBottom: 6 }}>
          Anzeigename
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10, lineHeight: 1.5 }}>
          Wird bei eigenen Bibliotheks-Formationen als "von …" angezeigt. Leer lassen für anonym ("Community-Formation").
        </div>
        {displayNameError && (
          <div style={{ fontSize: 13, color: "#b91c1c", background: "#fef2f2", borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>
            {displayNameError}
          </div>
        )}
        {displayNameSuccess && (
          <div style={{ fontSize: 13, color: "#166534", background: "#f0fdf4", borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>
            Gespeichert.
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={displayNameInput}
            onChange={(e) => { setDisplayNameInput(e.target.value); setDisplayNameSuccess(false); }}
            placeholder="z. B. Ralf M."
            maxLength={40}
            style={{
              flex: 1, borderRadius: 10, border: "1px solid #cbd5e1", padding: "9px 12px",
              fontSize: 13, outline: "none", boxSizing: "border-box" as const,
            }}
          />
          <button
            onClick={handleSaveDisplayName}
            disabled={setDisplayNameMutation.isPending}
            style={{
              borderRadius: 10, border: "1px solid var(--c-primary, #2563eb)",
              background: "var(--c-primary, #2563eb)", color: "white",
              padding: "9px 16px", fontSize: 13, cursor: setDisplayNameMutation.isPending ? "wait" : "pointer",
              fontWeight: 600, whiteSpace: "nowrap" as const,
            }}
          >
            {setDisplayNameMutation.isPending ? "…" : "Speichern"}
          </button>
        </div>
      </section>

      <section style={{
        background: "white", borderRadius: 16, padding: 18,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", marginBottom: 10 }}>
          Daten
        </div>
        {error && (
          <div style={{ fontSize: 13, color: "#b91c1c", background: "#fef2f2", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
            {error}
          </div>
        )}
        <div style={{ display: "grid", gap: 8 }}>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              borderRadius: 10, border: "1px solid #cbd5e1", background: "#f8fafc",
              padding: "9px 14px", fontSize: 13, color: exporting ? "#94a3b8" : "#334155",
              cursor: exporting ? "wait" : "pointer",
            }}
          >
            {exporting ? "Exportiere…" : "Account-Daten exportieren"}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              borderRadius: 10, border: "1px solid #fecaca", background: "#f8fafc",
              padding: "9px 14px", fontSize: 13, color: deleting ? "#fca5a5" : "#b91c1c",
              cursor: deleting ? "wait" : "pointer",
            }}
          >
            {deleting ? "Wird gelöscht…" : "Account löschen"}
          </button>
        </div>
      </section>
    </div>
  );
}
