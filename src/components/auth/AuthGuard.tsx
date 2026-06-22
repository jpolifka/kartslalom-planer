// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

export default function AuthGuard() {
  const { session } = useAuthStore();
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}
