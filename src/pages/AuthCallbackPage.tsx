// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, functionsUrl } from "../lib/supabase";
import { createTrack, saveTrack } from "../lib/api/tracks";
import { loadState, clearSavedState } from "../lib/storage";

// Übernimmt eine vorhandene Gast-Strecke aus localStorage in die Cloud,
// falls der Nutzer dort noch keine eigenen Strecken hat.
async function migrateLocalStorage() {
  const local = loadState();
  if (!local?.items.length) return;

  const { count } = await supabase
    .from("tracks")
    .select("id", { count: "exact", head: true });

  if (count && count > 0) return; // User hat schon Cloud-Tracks

  const trackId = await createTrack("Meine Strecke (migriert)");
  await saveTrack(trackId, {
    items: local.items,
    arrows: local.arrows,
    manualWidth: local.manualWidth,
    manualLength: local.manualLength,
    mapSatellite: false, // Free-User: kein Satellite, RPC würde es sowieso blocken
    mapOpacity: local.mapOpacity,
    areaSel: local.areaSel,
  });
  clearSavedState();
}

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    async function handleCallback() {
      // supabase.ts setzt flowType: "pkce" — der Link enthält daher
      // ?code=... (Query-Parameter), kein #fragment.
      const code = new URLSearchParams(window.location.search).get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) console.error("Code exchange failed:", error.message);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        await migrateLocalStorage();
      } catch (err) {
        console.error("localStorage-Migration fehlgeschlagen:", err);
      }

      navigate("/dashboard", { replace: true });
    }

    handleCallback();
  }, [navigate]);

  return <div style={{ padding: 40 }}>Anmelden…</div>;
}
