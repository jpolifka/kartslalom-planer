// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useNavigate } from "react-router-dom";
import { Library, Map, ShieldCheck } from "lucide-react";

// Diese Seite (und /admin/* generell) wird durch AdminGuard (Router-Ebene)
// geschützt: Zugriff erfordert eine gültige Session UND role='admin' in
// profiles, geprüft per RPC is_current_user_admin(). Nicht-Admins werden
// dort still zu /dashboard umgeleitet — hier selbst gibt es keine erneute
// Prüfung. Die eigentliche Autorisierung passiert aber ohnehin nicht hier,
// sondern serverseitig: alle Admin-RPCs (admin_list_*, admin_delete_*,
// admin_promote_to_library) sind SECURITY DEFINER-Funktionen mit eigenem
// role='admin'-Check — ein Client-seitiger Guard ist nur UX, kein Schutz.
type AdminCard = {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
};

// Was ein Admin hier kann, was ein normaler Nutzer nicht kann: fremde
// Formationen/Strecken (nicht nur die eigenen) einsehen, löschen und
// Formationen in die öffentliche Bibliothek befördern — alles über
// eigentümerübergreifende RPCs, die für normale Nutzer per RLS/Rollen-Check
// verweigert würden.
const CARDS: AdminCard[] = [
  {
    icon: <Library size={22} color="#6366f1" />,
    title: "Hindernisse",
    description: "Alle Formationen aller Nutzer einsehen, löschen oder in die öffentliche Bibliothek aufnehmen.",
    href: "/admin/formations",
  },
  {
    icon: <Map size={22} color="#6366f1" />,
    title: "Strecken",
    description: "Alle Strecken aller Nutzer einsehen und löschen. Im Editor als Lesezugriff öffnen.",
    href: "/admin/tracks",
  },
];

export default function AdminDashPage() {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <ShieldCheck size={24} color="#6366f1" />
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" }}>
          Admin
        </h1>
      </div>
      <p style={{ margin: "0 0 28px", fontSize: 14, color: "#64748b" }}>
        Verwaltungsfunktionen — nur für Admins sichtbar.
      </p>

      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {CARDS.map((card) => (
          <button
            key={card.href}
            onClick={() => navigate(card.href)}
            style={{
              background: "white", border: "1px solid #e2e8f0", borderRadius: 12,
              padding: "20px 18px", cursor: "pointer", textAlign: "left",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)", transition: "box-shadow 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)")}
          >
            <div style={{ marginBottom: 10 }}>{card.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 6 }}>
              {card.title}
            </div>
            <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
              {card.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
