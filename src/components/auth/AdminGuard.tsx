// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useIsAdmin } from "../../hooks/useCustomFormations";

export default function AdminGuard() {
  const { session } = useAuthStore();
  const { data: isAdmin, isLoading } = useIsAdmin();

  if (!session) return <Navigate to="/login" replace />;
  // RPC-Ergebnis noch ausstehend — warten bevor Redirect entschieden wird
  if (isLoading) return <div style={{ padding: 40, color: "#6b7280" }}>Laden…</div>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
