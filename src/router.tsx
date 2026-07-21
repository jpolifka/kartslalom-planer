// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import GlobalLayout from "./components/layout/GlobalLayout";
import LoginPage from "./pages/LoginPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import DashboardPage from "./pages/DashboardPage";
import EditorPage from "./pages/EditorPage";
import FormationEditorPage from "./pages/FormationEditorPage";
import FormationsPage from "./pages/FormationsPage";
import FormationSharePage from "./pages/FormationSharePage";
import SharedTrackPage from "./pages/SharedTrackPage";
import ImpressumPage from "./pages/ImpressumPage";
import SettingsPage from "./pages/SettingsPage";
import AuthGuard from "./components/auth/AuthGuard";
import AdminGuard from "./components/auth/AdminGuard";
import AdminDashPage from "./pages/AdminDashPage";
import AdminFormationsPage from "./pages/AdminFormationsPage";
import AdminTracksPage from "./pages/AdminTracksPage";

export default function AppRouter() {
  const { isLoading } = useAuthStore();
  // Warten bis main.tsx die initiale Session geladen hat — sonst würde AuthGuard
  // kurz "nicht eingeloggt" sehen und z. B. auf /login umleiten, obwohl der Nutzer
  // eigentlich eine gültige Session hat.
  if (isLoading) return <div style={{ padding: 40 }}>Laden…</div>;

  // Grundstruktur: alle Routen hängen unter GlobalLayout (Nav + useProfile-Ladevorgang).
  // Darunter drei Zonen mit steigenden Zugriffsanforderungen:
  //  1. Öffentlich — kein Guard (Login, Auth-Callback, Editor/Formation-Editor im
  //     Gast-Modus via localStorage, öffentliche Share-Links).
  //  2. <AuthGuard /> — nur mit Session erreichbar (Dashboard, eigene Formationen-
  //     Liste, Formation-Sharing, Settings).
  //  3. <AdminGuard /> — zusätzlich Admin-Rolle nötig (Moderations-Bereiche).
  return (
    <Routes>
      <Route element={<GlobalLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Editor: ohne Login (Gast-Modus, localStorage) oder eingeloggt (Cloud-Save) */}
        <Route path="/editor/new" element={<EditorPage />} />
        <Route path="/editor/:trackId" element={<EditorPage />} />

        {/* Hindernis-Editor: ohne Login nutzbar (localStorage), mit Login Cloud-Save */}
        <Route path="/formations/new" element={<FormationEditorPage />} />
        <Route path="/formations/:id" element={<FormationEditorPage />} />

        {/* Öffentliche Track-Share-Links: kein Login, kein AuthGuard */}
        <Route path="/share/:token" element={<SharedTrackPage />} />

        <Route element={<AuthGuard />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/formations" element={<FormationsPage />} />
          <Route path="/formations/:id/share" element={<FormationSharePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route element={<AdminGuard />}>
          <Route path="/admin" element={<AdminDashPage />} />
          <Route path="/admin/formations" element={<AdminFormationsPage />} />
          <Route path="/admin/tracks" element={<AdminTracksPage />} />
        </Route>

        <Route path="/impressum" element={<ImpressumPage />} />
        <Route path="/datenschutz" element={<Navigate to="/impressum#datenschutz" replace />} />

        {/* Unbekannte Pfade landen im Editor statt auf einer 404-Seite — die App hat
            keinen Gast-Modus-Zwischenschritt, der Editor ist der sinnvollste Default */}
        <Route path="*" element={<Navigate to="/editor/new" replace />} />
      </Route>
    </Routes>
  );
}
