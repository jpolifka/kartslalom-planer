// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useIsAdmin } from "../../hooks/useCustomFormations";

// Router-Guard für Admin-only-Routen (z.B. Formations-Verwaltung). Zusätzlich zur reinen
// Session-Prüfung (wie AuthGuard) wird per useIsAdmin() serverseitig per RPC geprüft, ob
// der eingeloggte Nutzer Admin-Rechte hat — der Admin-Status steht also NICHT im
// Client-Zustand (authStore/Profile), sondern muss bei jedem Guard-Mount (mit
// staleTime: 60s, siehe useIsAdmin) neu abgefragt werden, da er client-seitig sonst
// manipulierbar wäre.
export default function AdminGuard() {
  const { session } = useAuthStore();
  const { data: isAdmin, isLoading } = useIsAdmin();

  if (!session) return <Navigate to="/login" replace />;
  // RPC-Ergebnis noch ausstehend — warten bevor Redirect entschieden wird
  if (isLoading) return <div style={{ padding: 40, color: "#6b7280" }}>Laden…</div>;
  // Kein Admin: unauffällig zum Dashboard statt z.B. einer expliziten "Kein Zugriff"-Seite —
  // vermeidet, dass Nicht-Admins gezielt nach Admin-Routen suchen/URL erraten.
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
