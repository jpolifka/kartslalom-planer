// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

// Router-Guard für alle Routen, die nur eine bestehende Session voraussetzen (kein
// Rollen-Check). Kein eigener Ladezustand nötig: router.tsx wartet bereits global auf
// authStore.isLoading (initiales getSession() aus main.tsx), bevor diese Route überhaupt
// gerendert wird — hier ist `session` also schon final. <Outlet /> rendert die
// verschachtelten Kind-Routen; ohne Session Redirect nach /login.
export default function AuthGuard() {
  const { session } = useAuthStore();
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}
