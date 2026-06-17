// account-export — DSGVO-Datenexport für eingeloggte User
// Gibt ein JSON-Archiv mit Profil, allen Strecken und Versionen zurück.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
  }

  const uid = user.id;

  const [profileRes, tracksRes] = await Promise.all([
    admin.from("profiles").select("id, email, tier, created_at, last_active_at").eq("id", uid).single(),
    admin.from("tracks").select("id, name, description, state_json, area_sel_json, manual_width, manual_length, map_satellite, map_opacity, created_at, updated_at").eq("owner_id", uid).order("created_at"),
  ]);

  if (profileRes.error) {
    return new Response(JSON.stringify({ error: "profile_not_found" }), { status: 404, headers: corsHeaders });
  }

  // Versionen für alle Strecken laden
  const trackIds = (tracksRes.data ?? []).map((t) => t.id);
  const versionsRes = trackIds.length > 0
    ? await admin.from("track_versions").select("track_id, version_number, state_json, area_sel_json, created_at").in("track_id", trackIds).order("created_at")
    : { data: [] };

  const exportData = {
    exported_at: new Date().toISOString(),
    profile: profileRes.data,
    tracks: tracksRes.data ?? [],
    track_versions: versionsRes.data ?? [],
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="kartslalom-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});
