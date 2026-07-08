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

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL         = Deno.env.get("SITE_URL") ?? "https://kart.cheezuscraizt.de";

const MAX_WIDTH = 3000;
const MAX_HEIGHT = 3000;
const MAX_PIXELS = 6_000_000;

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
// Nur hier gelistete Provider-IDs sind aufrufbar.
const PROVIDERS: Record<string, WmsProvider> = {
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

  const wmsRes = await fetch(`${provider.baseUrl}?${params.toString()}`);
  if (!wmsRes.ok) return json({ error: "upstream_error" }, 502, cors);

  const imageBuffer = await wmsRes.arrayBuffer();
  return new Response(imageBuffer, {
    status: 200,
    headers: { ...cors, "Content-Type": provider.format },
  });
}

Deno.serve(handler);
