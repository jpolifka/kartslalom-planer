// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

export default function AdminGuard() {
  const { session, profile } = useAuthStore();

  if (!session) return <Navigate to="/login" replace />;
  // Profile noch nicht geladen — warten (GlobalLayout ruft useProfile() auf)
  if (!profile) return <div style={{ padding: 40 }}>Laden…</div>;
  if (profile.role !== "admin") return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
