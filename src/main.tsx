// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "./lib/supabase";
import { useAuthStore } from "./store/authStore";
import AppRouter from "./router";
import "./index.css";

// Globaler React-Query-Client für die ganze App. staleTime 30s ist der Default für
// alle Queries; einzelne Hooks überschreiben das gezielt (z. B. staleTime: 0 für
// Listen, die immer frisch sein sollen, oder 10min für die selten ändernde Library).
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

// Einmaliger Abruf der bestehenden Session beim App-Start (z. B. Seiten-Reload) —
// useAuthStore.getState() statt des Hooks, da wir hier außerhalb einer React-Komponente sind.
supabase.auth.getSession()
  .then(({ data: { session } }) => {
    useAuthStore.getState().setSession(session);
  })
  .catch(() => {
    // Netzwerkfehler beim Start → unauthentifiziert, nicht eingefroren
    useAuthStore.getState().setSession(null);
  });

// Hält den authStore danach laufend synchron mit Supabase (Login/Logout/Token-Refresh
// in anderen Tabs eingeschlossen). Bei Logout wird das Profil explizit gelöscht, da es
// sonst (Tarif/Rolle des vorherigen Nutzers) veraltet im Store hängen bliebe.
supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.getState().setSession(session);
  if (!session) useAuthStore.getState().setProfile(null);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AppRouter />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
