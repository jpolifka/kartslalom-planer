// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { LogOut, MessageSquare, ShieldCheck, HelpCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import FeedbackDialog from "../FeedbackDialog";
import HelpModal from "../help/HelpModal";
import TrackHelpContent from "../help/TrackHelpContent";
import FormationHelpContent from "../help/FormationHelpContent";

const navLink: React.CSSProperties = { color: "#475569", textDecoration: "none", fontSize: 13 };
const dim: React.CSSProperties = { color: "#94a3b8", fontSize: 13 };

// /formations/new oder /formations/:id, aber nicht /formations (Liste) oder /formations/:id/share
const FORMATION_EDITOR_PATH = /^\/formations\/[^/]+$/;

export default function GlobalNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, profile } = useAuthStore();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const isTrackEditor = location.pathname.startsWith("/editor/");
  const isFormationEditor = FORMATION_EDITOR_PATH.test(location.pathname);
  // Dashboard/Einstellungen haben keinen eigenen Hilfe-Inhalt — die
  // Track-Hilfe deckt Streckenliste, Versionen und Konto bereits ab.
  const isGeneralHelp = location.pathname === "/dashboard" || location.pathname === "/settings";
  const helpAvailable = isTrackEditor || isFormationEditor || isGeneralHelp;

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
            {profile?.role === "admin" && (
              <Link
                to="/admin"
                style={{ ...navLink, display: "inline-flex", alignItems: "center", gap: 4, color: "#6366f1", fontWeight: 600 }}
              >
                <ShieldCheck size={13} /> Admin
              </Link>
            )}
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
        {helpAvailable && (
          <>
            <span style={{ width: 1, height: 16, background: "#e2e8f0" }} />
            <button
              onClick={() => setHelpOpen(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                border: "none", background: "none", padding: 0, cursor: "pointer",
                color: "var(--c-primary)", fontSize: 13,
              }}
            >
              <HelpCircle size={13} /> Hilfe
            </button>
          </>
        )}
        <span style={{ width: 1, height: 16, background: "#e2e8f0" }} />
        <button
          onClick={() => setFeedbackOpen(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            border: "none", background: "none", padding: 0, cursor: "pointer",
            color: "#475569", fontSize: 13,
          }}
        >
          <MessageSquare size={13} /> Feedback
        </button>
        <span style={{ width: 1, height: 16, background: "#e2e8f0" }} />
        <Link to="/impressum" style={dim}>Impressum</Link>
      </nav>
      <FeedbackDialog isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      {helpOpen && (
        <HelpModal title="Hilfe" onClose={() => setHelpOpen(false)}>
          {isTrackEditor ? <TrackHelpContent /> : <FormationHelpContent />}
        </HelpModal>
      )}
    </header>
  );
}
