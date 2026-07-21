// map-background-image — kontrollierter Server-Proxy für WMS-Kartenhintergründe
// im Export (SVG/PDF/PNG). Nur für reproduzierbare Exporte gedacht — der
// interaktive Editor ruft den WMS-Dienst weiterhin direkt vom Client auf
// (siehe src/lib/mapRender.ts), das ist hierfür bewusst nicht nötig.
//
// Nimmt NUR providerId + bbox + width + height vom Client entgegen, NIE eine
// beliebige URL — sonst entsteht ein SSRF-Proxy. Die tatsächliche WMS-URL
// wird ausschließlich aus der serverseitigen PROVIDERS-Allowlist gebaut.
//
// Kein externer Import — nur fetch() gegen Supabase REST/Auth API und den
// WMS-Dienst (gleiche Konvention wie die übrigen Functions in diesem Repo).
//
// Einzige Quelle der Wahrheit für diese Function: main/index.ts (self-hosted
// Fat-Router-Dispatcher, siehe dortiger Kommentar) importiert handler direkt
// von hier statt die Logik zu duplizieren. index.ts bleibt der dünne
// Deno.serve-Entrypoint für Supabase-Cloud-Deployment / EdgeRuntime-
// Worker-Fallback (unbekannte Service-Namen in main/index.ts).

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL         = Deno.env.get("SITE_URL") ?? "https://kart.cheezuscraizt.de";

// Resourcen-Schutz gegen Missbrauch/Kosten, nicht nur "sinnvolle Defaults":
// riesige Breite/Höhe würde diese Function (und den WMS-Anbieter) unnötig
// belasten; das Zeit-Limit verhindert, dass ein hängender Upstream-Request
// den Edge-Function-Worker dauerhaft blockiert; das Byte-Limit deckelt, wie
// viel ein (potenziell falsch konfigurierter) Provider-Eintrag an Traffic
// durch diese Function schleusen kann.
const MAX_WIDTH = 3000;
const MAX_HEIGHT = 3000;
const MAX_PIXELS = 6_000_000;
const UPSTREAM_TIMEOUT_MS = 10_000;
const MAX_UPSTREAM_BYTES = 15 * 1024 * 1024;

// Erdradius-Konstante der Web-Mercator-Projektion (EPSG:3857) — muss zur
// Umrechnung in src/lib/geo.ts (lngToMercatorX/latToMercatorY) passen.
const WEB_MERCATOR_R = 6378137;

type WmsProvider = {
  baseUrl: string;
  layers: string;
  format: string;
  version: "1.1.1" | "1.3.0";
  coverage: { west: number; south: number; east: number; north: number };
};

// Serverseitige Allowlist — bewusst dupliziert aus src/lib/mapProviders.ts
// (Edge Functions in diesem Repo importieren keinen App-Code, siehe oben).
// Nur hier gelistete Provider-IDs sind aufrufbar. Export nur für den
// Konfig-Drift-Contract-Test (mapProviderConfigDrift.test.ts).
export const PROVIDERS: Record<string, WmsProvider> = {
  rlp_dop20: {
    baseUrl: "https://geo4.service24.rlp.de/wms/rp_dop20.fcgi",
    layers: "rp_dop20",
    format: "image/jpeg",
    version: "1.1.1",
    coverage: { west: 6.037773, south: 48.897996, east: 8.617703, north: 51.000893 },
  },
};

function mercatorXToLng(x: number): number {
  return (x / WEB_MERCATOR_R) * (180 / Math.PI);
}

function mercatorYToLat(y: number): number {
  return (2 * Math.atan(Math.exp(y / WEB_MERCATOR_R)) - Math.PI / 2) * (180 / Math.PI);
}

// CORS: gleiche Konvention wie in den übrigen Functions dieses Repos —
// Origin wird nur für lokale Dev-Server gespiegelt, sonst immer SITE_URL.
// Schützt nur browserseitig das Lesen der Antwort; die eigentliche
// Zugriffskontrolle sind Bearer-Prüfung + Tier-Check weiter unten. Kong hat
// vor dieser Function zusätzlich eine eigene statische CORS-Origin-Liste
// (siehe docker/supabase/volumes/api/kong.yml, functions-v1-Route).
function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const isLocal = origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
  return {
    "Access-Control-Allow-Origin": isLocal ? origin : SITE_URL,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Vary": "Origin",
  };
}

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export async function handler(req: Request): Promise<Response> {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);

  const bearer = req.headers.get("authorization");
  if (!bearer) return json({ error: "unauthorized" }, 401, cors);

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { "apikey": SERVICE_ROLE_KEY, "Authorization": bearer },
  });
  if (!userRes.ok) return json({ error: "invalid_token" }, 401, cors);
  const user = await userRes.json();

  // Tier/is_deleted werden serverseitig per Service-Role-Key frisch aus der
  // DB gelesen statt z. B. Claims aus dem JWT zu vertrauen — ein Client
  // könnte einen alten/gecachten Token mit veraltetem Tier vorzeigen, oder
  // der Account könnte zwischenzeitlich (soft-)gelöscht worden sein. Diese
  // Prüfung ist zugleich die Monetarisierungsgrenze: Luftbilder sind ein
  // Pro/Team-Feature (Bandbreiten-/Lizenzkosten gegenüber dem WMS-Anbieter),
  // konsistent mit der Tarif-Gate-Logik in src/lib/mapProviders.ts im Frontend.
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=tier,is_deleted`,
    { headers: { "apikey": SERVICE_ROLE_KEY, "Authorization": `Bearer ${SERVICE_ROLE_KEY}` } },
  );
  const profiles = await profileRes.json();
  const profile = Array.isArray(profiles) ? profiles[0] : null;
  if (!profile || profile.is_deleted) return json({ error: "account_deleted" }, 401, cors);
  if (profile.tier === "free") return json({ error: "premium_required" }, 403, cors);

  let body: { providerId?: string; bbox?: unknown; width?: number; height?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_body" }, 400, cors);
  }

  const provider = body.providerId ? PROVIDERS[body.providerId] : undefined;
  if (!provider) return json({ error: "unknown_provider" }, 400, cors);

  const bbox = body.bbox;
  if (
    !Array.isArray(bbox) ||
    bbox.length !== 4 ||
    !bbox.every((n) => typeof n === "number" && Number.isFinite(n))
  ) {
    return json({ error: "invalid_bbox" }, 400, cors);
  }
  const [minx, miny, maxx, maxy] = bbox as [number, number, number, number];
  if (minx >= maxx || miny >= maxy) return json({ error: "invalid_bbox" }, 400, cors);

  const west = mercatorXToLng(minx);
  const east = mercatorXToLng(maxx);
  const south = mercatorYToLat(miny);
  const north = mercatorYToLat(maxy);
  // Coverage-Check spiegelt die Abdeckung des Providers (hier: Rheinland-
  // Pfalz), die auch dem Frontend in src/lib/mapProviders.ts bekannt ist
  // (siehe mapProviderConfigDrift.test.ts, das genau diese Zahlen gegeneinander
  // abgleicht). Verhindert unnötige/sinnlose Anfragen an den WMS-Dienst für
  // Bereiche außerhalb seiner Zuständigkeit — kein Sicherheits-, sondern ein
  // Korrektheits-/Ressourcen-Check, die eigentliche SSRF-Absicherung ist die
  // PROVIDERS-Allowlist oben.
  const c = provider.coverage;
  const withinCoverage = west >= c.west && east <= c.east && south >= c.south && north <= c.north;
  if (!withinCoverage) return json({ error: "bbox_outside_coverage" }, 400, cors);

  const width = body.width;
  const height = body.height;
  if (
    typeof width !== "number" || typeof height !== "number" ||
    !Number.isFinite(width) || !Number.isFinite(height) ||
    width <= 0 || height <= 0 ||
    width > MAX_WIDTH || height > MAX_HEIGHT ||
    width * height > MAX_PIXELS
  ) {
    return json({ error: "invalid_dimensions" }, 400, cors);
  }

  const params = new URLSearchParams({
    SERVICE: "WMS",
    REQUEST: "GetMap",
    VERSION: provider.version,
    LAYERS: provider.layers,
    STYLES: "",
    FORMAT: provider.format,
    SRS: "EPSG:3857",
    BBOX: bbox.map((n) => (n as number).toFixed(2)).join(","),
    WIDTH: String(Math.round(width)),
    HEIGHT: String(Math.round(height)),
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let wmsRes: Response;
  try {
    wmsRes = await fetch(`${provider.baseUrl}?${params.toString()}`, { signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return json({ error: "upstream_timeout" }, 504, cors);
    }
    return json({ error: "upstream_error" }, 502, cors);
  } finally {
    clearTimeout(timeout);
  }
  if (!wmsRes.ok) return json({ error: "upstream_error" }, 502, cors);

  // WMS-Dienste liefern Fehler teils als XML/HTML mit HTTP 200 — Content-Type
  // erzwingen statt dem Upstream-Status blind zu vertrauen.
  const contentType = wmsRes.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return json({ error: "invalid_upstream_response" }, 502, cors);
  }
  const contentLength = Number(wmsRes.headers.get("content-length") ?? NaN);
  if (Number.isFinite(contentLength) && contentLength > MAX_UPSTREAM_BYTES) {
    return json({ error: "upstream_response_too_large" }, 502, cors);
  }

  const imageBuffer = await wmsRes.arrayBuffer();
  if (imageBuffer.byteLength > MAX_UPSTREAM_BYTES) {
    return json({ error: "upstream_response_too_large" }, 502, cors);
  }
  return new Response(imageBuffer, {
    status: 200,
    headers: { ...cors, "Content-Type": provider.format },
  });
}
