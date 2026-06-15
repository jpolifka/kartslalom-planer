// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useAuthStore } from "../store/authStore";

export default function SettingsPage() {
  const { session, profile } = useAuthStore();

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
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", marginBottom: 10 }}>
          Daten
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <button
            disabled
            title="Kommt in Kürze"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              borderRadius: 10, border: "1px solid #cbd5e1", background: "#f8fafc",
              padding: "9px 14px", fontSize: 13, color: "#94a3b8", cursor: "not-allowed",
            }}
          >
            Account-Daten exportieren (kommt in Kürze)
          </button>
          <button
            disabled
            title="Kommt in Kürze"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              borderRadius: 10, border: "1px solid #fecaca", background: "#f8fafc",
              padding: "9px 14px", fontSize: 13, color: "#fca5a5", cursor: "not-allowed",
            }}
          >
            Account löschen (kommt in Kürze)
          </button>
        </div>
      </section>
    </div>
  );
}
