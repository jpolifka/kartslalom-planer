// account-export — DSGVO-Datenexport für eingeloggte User
// Kein externer Import — nur fetch() gegen Supabase REST/Auth API.
//
// Einzige Quelle der Wahrheit für diese Function: main/index.ts (self-hosted
// Fat-Router-Dispatcher, siehe dortiger Kommentar) importiert handler direkt
// von hier statt die Logik zu duplizieren. index.ts bleibt der dünne
// Deno.serve-Entrypoint für Supabase-Cloud-Deployment / EdgeRuntime-
// Worker-Fallback (unbekannte Service-Namen in main/index.ts).

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL         = Deno.env.get("SITE_URL") ?? "https://kart.cheezuscraizt.de";

// CORS: Der Origin wird nur für lokale Dev-Server (beliebiger
// localhost/127.0.0.1-Port, z. B. Vite auf 5173/5174) 1:1 gespiegelt; für
// alle anderen Aufrufer wird immer SITE_URL zurückgegeben, unabhängig vom
// tatsächlichen Origin-Header der Anfrage. Der Browser vergleicht
// Access-Control-Allow-Origin mit dem eigenen Origin und blockiert das
// Lesen der Antwort bei einem Mismatch — das schützt aber nur browserseitig
// vor fremden Web-Origins. Ein Server-zu-Server-Aufruf (curl, fetch ohne
// Browser) ignoriert CORS komplett; die eigentliche Zugriffskontrolle ist
// die Bearer-Token-Prüfung weiter unten (Kong setzt vor dieser Function
// zusätzlich eine eigene, statische CORS-Origin-Liste, siehe
// docker/supabase/volumes/api/kong.yml, functions-v1-Route).
function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const isLocal = origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
  return {
    "Access-Control-Allow-Origin": isLocal ? origin : SITE_URL,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Vary": "Origin",
  };
}

// Service-Role-Key umgeht Row-Level-Security vollständig. Wird deshalb erst
// NACH erfolgreicher Auth-Prüfung (userRes.ok) benutzt, und jede Query unten
// filtert explizit auf die per Token ermittelte uid (id=eq./owner_id=eq.) —
// ohne diesen Filter könnte jeder eingeloggte User beliebige fremde
// Profile/Strecken abziehen.
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

  // Erwartetes Format: "Authorization: Bearer <access_token>" — das
  // Supabase-Session-JWT des eingeloggten Clients, unverändert an
  // /auth/v1/user unten durchgereicht.
  const bearer = req.headers.get("authorization");
  if (!bearer) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

  // Token wird NICHT lokal per Signatur/JWKS geprüft, sondern zur
  // Introspektion an Supabase Auth (/auth/v1/user) übergeben. Das ist
  // bewusst so: dieser Weg erkennt auch zwischenzeitlich widerrufene oder
  // abgelaufene Sessions, die ein rein lokaler Signatur-Check fälschlich
  // noch als gültig durchwinken würde.
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { "apikey": SERVICE_ROLE_KEY, "Authorization": bearer },
  });
  if (!userRes.ok) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: cors });
  const user = await userRes.json();
  const uid: string = user.id;

  const [profileRes, tracksRes] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}&select=id,email,tier,created_at,last_active_at`,
      { headers: serviceHeaders() },
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/tracks?owner_id=eq.${uid}&select=id,name,description,state_json,area_sel_json,manual_width,manual_length,map_provider_id,map_opacity,created_at,updated_at&order=created_at`,
      { headers: serviceHeaders() },
    ),
  ]);
  const profiles = await profileRes.json();
  const tracks = await tracksRes.json();

  // Versions-Fetch nur wenn tatsächlich Strecken existieren: erspart einen
  // unnötigen dritten Request für neue/leere Accounts und vermeidet einen
  // leeren "in.()"-Filter, dessen Verhalten bei PostgREST für eine leere
  // Werteliste nicht das ist, was wir hier wollen (kein "alle Zeilen").
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

  // Content-Disposition: attachment erzwingt beim Browser einen Download
  // statt die JSON-Antwort inline im Tab zu rendern (DSGVO-Datenexport soll
  // als Datei ankommen, nicht als Seiteninhalt). Das Datum im Dateinamen
  // dient nur der Nutzerfreundlichkeit/Nachvollziehbarkeit bei mehreren
  // Exporten, hat keine sicherheitsrelevante Funktion.
  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="kartslalom-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
