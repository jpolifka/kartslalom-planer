// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { Link, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";

const navLink: React.CSSProperties = { color: "#475569", textDecoration: "none", fontSize: 13 };
const dim: React.CSSProperties = { color: "#94a3b8", fontSize: 13 };

export default function GlobalNav() {
  const navigate = useNavigate();
  const { session, profile } = useAuthStore();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <header style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 20px", height: 48, background: "white", flexShrink: 0,
      borderBottom: "1px solid #e5e7eb", zIndex: 100,
    }}>
      <Link to={session ? "/dashboard" : "/"} style={{ fontWeight: 800, fontSize: 16, color: "var(--c-primary)", textDecoration: "none" }}>
        Kartslalom Streckenplaner
      </Link>

      <nav style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {session ? (
          <>
            <Link to="/dashboard" style={navLink}>Meine Strecken</Link>
            <Link to="/formations" style={navLink}>Meine Hindernisse</Link>
            <Link to="/settings" style={navLink}>Einstellungen</Link>
            <span style={{ width: 1, height: 16, background: "#e2e8f0" }} />
            {profile && <span style={dim}>{profile.email}</span>}
            <button
              onClick={handleLogout}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                border: "1px solid #cbd5e1", background: "white", borderRadius: 7,
                padding: "5px 10px", cursor: "pointer", color: "#475569", fontSize: 12,
              }}
            >
              <LogOut size={12} /> Abmelden
            </button>
          </>
        ) : (
          <Link to="/login" style={{ ...navLink, fontWeight: 600, color: "var(--c-primary)" }}>Anmelden</Link>
        )}
        <span style={{ width: 1, height: 16, background: "#e2e8f0" }} />
        <Link to="/impressum" style={dim}>Impressum</Link>
      </nav>
    </header>
  );
}
