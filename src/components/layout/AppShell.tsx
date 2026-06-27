// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { Outlet, Link, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import { useProfile } from "../../hooks/useProfile";

export default function AppShell() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  useProfile();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", color: "#0f172a" }}>
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 20px", background: "white",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        <Link to="/dashboard" style={{ fontWeight: 800, fontSize: 17, color: "var(--c-primary)", textDecoration: "none" }}>
          Kartslalom Streckenplaner
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 13 }}>
          <Link to="/dashboard" style={{ color: "#475569", textDecoration: "none" }}>Strecken</Link>
          <Link to="/formations" style={{ color: "#475569", textDecoration: "none" }}>Hindernisse</Link>
          <Link to="/settings" style={{ color: "#475569", textDecoration: "none" }}>Einstellungen</Link>
          {profile && <span style={{ color: "#94a3b8" }}>{profile.email}</span>}
          <button
            onClick={handleLogout}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              border: "1px solid #cbd5e1", background: "white", borderRadius: 8,
              padding: "6px 10px", cursor: "pointer", color: "#475569", fontSize: 12,
            }}
          >
            <LogOut size={13} /> Abmelden
          </button>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
