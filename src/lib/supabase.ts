// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Erwartete Env-Variablen (Vite, zur Build-Zeit eingebettet):
// VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY. Es gibt hier bewusst KEINE
// eigene Validierung/Fehlerbehandlung für fehlende Werte — bei fehlender
// Konfiguration erhält createClient() `undefined` (as string erzwungen) und
// schlägt erst beim ersten echten Netzwerkzugriff fehl (z. B. ungültige
// Fetch-URL), nicht schon beim Import dieses Moduls. Das ist ausreichend für
// dieses Projekt, da die Variablen über die Deploy-Pipeline gesetzt werden
// und ihr Fehlen ein Build-/Deploy-Konfigurationsfehler wäre, kein zur
// Laufzeit vom Nutzer auslösbarer Zustand.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export function functionsUrl(name: string): string {
  return `${SUPABASE_URL}/functions/v1/${name}`;
}

// Lazy singleton — createClient() wird erst beim ersten echten Zugriff ausgeführt,
// nicht beim Import. Unit-Tests können so vi.mock("./supabase") nutzen ohne dass
// VITE_SUPABASE_URL gesetzt sein muss.
let _instance: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (!_instance) {
    _instance = createClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      { auth: { flowType: "pkce" } }
    );
  }
  return _instance;
}

// Backward-compatible export: `supabase.from(...)` etc. bleibt unverändert nutzbar.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    const client = getSupabase();
    const val = client[prop as keyof SupabaseClient];
    return typeof val === "function" ? (val as (...a: unknown[]) => unknown).bind(client) : val;
  },
});
