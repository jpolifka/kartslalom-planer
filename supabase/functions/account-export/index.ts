// account-export — DSGVO-Datenexport für eingeloggte User
// Kein externer Import — nur fetch() gegen Supabase REST/Auth API.

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL         = Deno.env.get("SITE_URL") ?? "https://kart.cheezuscraizt.de";

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const isLocal = origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
  return {
    "Access-Control-Allow-Origin": isLocal ? origin : SITE_URL,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Vary": "Origin",
  };
}

function serviceHeaders() {
  return {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function handler(req: Request): Promise<Response> {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const bearer = req.headers.get("authorization");
  if (!bearer) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { "apikey": SERVICE_ROLE_KEY, "Authorization": bearer },
  });
  if (!userRes.ok) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: cors });
  const user = await userRes.json();
  const uid: string = user.id;

  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}&select=id,email,tier,created_at,last_active_at`,
    { headers: serviceHeaders() },
  );
  const profiles = await profileRes.json();

  const tracksRes = await fetch(
    `${SUPABASE_URL}/rest/v1/tracks?owner_id=eq.${uid}&select=id,name,description,state_json,area_sel_json,manual_width,manual_length,map_satellite,map_opacity,created_at,updated_at&order=created_at`,
    { headers: serviceHeaders() },
  );
  const tracks = await tracksRes.json();

  const trackIds: string[] = Array.isArray(tracks) ? tracks.map((t: { id: string }) => t.id) : [];
  let versions: unknown[] = [];
  if (trackIds.length > 0) {
    const versionsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/track_versions?track_id=in.(${trackIds.join(",")})&select=track_id,version_number,state_json,area_sel_json,created_at&order=created_at`,
      { headers: serviceHeaders() },
    );
    versions = await versionsRes.json();
  }

  const exportData = {
    exported_at: new Date().toISOString(),
    profile: Array.isArray(profiles) ? profiles[0] : null,
    tracks: tracks ?? [],
    track_versions: versions,
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="kartslalom-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

Deno.serve(handler);
