// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetUsername } from "../hooks/useCustomFormations";

const USERNAME_RE = /^[a-z0-9_-]{3,24}$/;

export default function UsernameOnboardingPage() {
  const navigate = useNavigate();
  const { mutateAsync, isPending } = useSetUsername();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const normalized = value.toLowerCase().trim();
  const isValid = USERNAME_RE.test(normalized);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || isPending) return;
    setError(null);
    try {
      await mutateAsync(normalized);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "UNKNOWN";
      if (msg === "USERNAME_TAKEN") setError("Dieser Benutzername ist bereits vergeben.");
      else if (msg === "INVALID_USERNAME") setError("Ungültiger Benutzername.");
      else setError("Fehler beim Speichern. Bitte erneut versuchen.");
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb" }}>
      <div style={{ background: "white", borderRadius: 16, padding: 36, width: 400, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800, color: "#111827" }}>Benutzername wählen</h2>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "#6b7280", lineHeight: 1.5 }}>
          Damit andere Nutzer Hindernisse mit dir teilen können, brauchst du einen Benutzernamen.
          Er kann später nicht mehr geändert werden.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>
              Benutzername
            </label>
            <input
              autoFocus
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(null); }}
              placeholder="z.B. maxmuster"
              maxLength={24}
              style={{
                width: "100%", padding: "9px 12px", fontSize: 15,
                border: `1px solid ${error ? "#ef4444" : value && !isValid ? "#f59e0b" : "#d1d5db"}`,
                borderRadius: 8, boxSizing: "border-box",
              }}
            />
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
              3–24 Zeichen, nur Kleinbuchstaben, Ziffern, _ und -
            </div>
            {value && !isValid && (
              <div style={{ fontSize: 12, color: "#f59e0b", marginTop: 2 }}>Ungültiges Format</div>
            )}
            {error && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 2 }}>{error}</div>}
          </div>

          <button
            type="submit"
            disabled={!isValid || isPending}
            style={{
              padding: "10px 0", fontSize: 14, fontWeight: 700,
              border: "none", borderRadius: 8, cursor: isValid && !isPending ? "pointer" : "not-allowed",
              background: isValid && !isPending ? "var(--c-primary)" : "#93c5fd", color: "white",
            }}
          >
            {isPending ? "Speichern…" : "Benutzernamen speichern"}
          </button>
        </form>
      </div>
    </div>
  );
}
