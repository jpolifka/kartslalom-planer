/**
 * E2E API Helper — Direktaufruf von save_track() via supabase-js (Node-seitig,
 * kein Browser/CORS involviert), analog zu global-setup.ts.
 *
 * Genutzt um einen Streckenbereich (area_sel_json + map_provider_id) zu
 * setzen, ohne die Maus-Zieh-Interaktion von MapSelector.tsx nachbauen zu
 * müssen (kein Adress-/Koordinaten-Eingabefeld vorhanden — Auswahl ist rein
 * per Pan/Zoom/Draw auf der Karte möglich).
 */

import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import type { E2ECredentials } from "../global-setup";

const supabaseOpts = { realtime: { transport: ws } } as Parameters<typeof createClient>[2];

export type TestAreaSelection = {
  centerLat: number;
  centerLng: number;
  widthM: number;
  heightM: number;
  rotationDeg: number;
};

export async function saveTrackArea(
  credentials: E2ECredentials,
  trackId: string,
  area: TestAreaSelection,
  satellite: boolean
): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("SUPABASE_URL/SUPABASE_ANON_KEY müssen gesetzt sein (siehe global-setup.ts).");
  }

  const client = createClient(url, anonKey, {
    ...supabaseOpts,
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: sessionErr } = await client.auth.setSession({
    access_token: credentials.session.access_token,
    refresh_token: credentials.session.refresh_token,
  });
  if (sessionErr) throw new Error(`Session setzen fehlgeschlagen: ${sessionErr.message}`);

  const { error } = await client.rpc("save_track", {
    p_track_id: trackId,
    p_state_json: { items: [], arrows: [] },
    p_area_sel: area,
    p_width: 18,
    p_length: 36,
    p_satellite: satellite,
    p_opacity: 0.7,
  });
  if (error) throw new Error(`save_track RPC fehlgeschlagen: ${error.message}`);
}
