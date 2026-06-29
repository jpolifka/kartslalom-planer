// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

export default function AuthGuard() {
  const { session, profile } = useAuthStore();
  if (!session) return <Navigate to="/login" replace />;
  // Profil noch nicht geladen → warten (profile ist null bis useProfile fertig ist)
  if (profile !== null && profile.username === null) {
    return <Navigate to="/onboarding/username" replace />;
  }
  return <Outlet />;
}
