// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import LoginPage from "./pages/LoginPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import DashboardPage from "./pages/DashboardPage";
import EditorPage from "./pages/EditorPage";
import SettingsPage from "./pages/SettingsPage";
import AuthGuard from "./components/auth/AuthGuard";
import AppShell from "./components/layout/AppShell";

export default function AppRouter() {
  const { isLoading } = useAuthStore();
  if (isLoading) return <div style={{ padding: 40 }}>Laden…</div>;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      {/* Editor: ohne Login (Gast-Modus, localStorage) oder eingeloggt (Cloud-Save) */}
      <Route path="/editor/new" element={<EditorPage />} />
      <Route path="/editor/:trackId" element={<EditorPage />} />

      <Route element={<AuthGuard />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/editor/new" replace />} />
    </Routes>
  );
}
