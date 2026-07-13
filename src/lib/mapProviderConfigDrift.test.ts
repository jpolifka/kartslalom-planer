// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

// Contract-Test gegen Konfig-Drift: RLP-DOP20-URL/Layer/Version/Coverage sind
// bewusst zwischen Frontend (mapProviders.ts) und Edge Function
// (map-background-image/handler.ts) dupliziert — Edge Functions importieren
// keinen App-Code, siehe dortige Kommentare. Dieser Test stellt sicher, dass
// ein künftiger Wert-Wechsel (z. B. neue Coverage-BBox oder Endpoint-URL)
// nicht nur an einer Stelle landet.
//
// Innerhalb der Edge Functions selbst gibt es seit dem Handler.ts-Refactor
// (Red-Team-Review 2026-07-13) keine zweite Kopie mehr: main/index.ts
// importiert den handleMapBackgroundImage-Handler direkt aus
// map-background-image/handler.ts statt ihn zu duplizieren — der zweite Test
// unten prüft genau das (Import statt eigener PROVIDERS-Kopie).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";
import { MAP_PROVIDERS } from "./mapProviders";

// map-background-image/index.ts liest Env-Variablen und ruft Deno.serve()
// beim Modul-Import auf — minimal stubben, analog zu map-background-image.test.ts.
vi.stubGlobal("Deno", {
  env: {
    get: (key: string) =>
      ({ SUPABASE_URL: "http://supabase.test", SUPABASE_SERVICE_ROLE_KEY: "svc-key" })[key],
  },
  serve: vi.fn(),
});

const appWms = MAP_PROVIDERS.rlp_dop20.wms!;
const appCoverage = MAP_PROVIDERS.rlp_dop20.coverage!;

describe("RLP-DOP20-Konfiguration bleibt zwischen Frontend und Edge Functions synchron", () => {
  it("supabase/functions/map-background-image/index.ts (kanonischer Export-Proxy) stimmt mit mapProviders.ts überein", async () => {
    const { PROVIDERS } = await import("../../supabase/functions/map-background-image/index.ts");
    const edgeProvider = PROVIDERS.rlp_dop20;

    expect(edgeProvider.baseUrl).toBe(appWms.baseUrl);
    expect(edgeProvider.layers).toBe(appWms.layers);
    expect(edgeProvider.format).toBe(appWms.format);
    expect(edgeProvider.version).toBe(appWms.version);
    expect(edgeProvider.coverage).toEqual(appCoverage);
  });

  it("supabase/functions/main/index.ts importiert den Handler statt ihn zu duplizieren (keine zweite PROVIDERS-Kopie)", () => {
    // Regressionstest für den Red-Team-Review-2026-07-13-Fund: main/index.ts
    // hatte früher eine eigene MBI_PROVIDERS-Kopie, die bei einem Fix leicht
    // vergessen werden konnte (ist bei send-welcome/delete-account real
    // passiert). Seit dem Handler.ts-Refactor importiert main/index.ts den
    // Handler direkt — dieser Test stellt sicher, dass niemand versehentlich
    // wieder eine eigene Kopie der Provider-Konfiguration einführt.
    const mainPath = join(process.cwd(), "supabase/functions/main/index.ts");
    const source = readFileSync(mainPath, "utf-8");

    expect(source).not.toMatch(/const MBI_PROVIDERS/);
    expect(source).not.toMatch(/rp_dop20\.fcgi/);
    expect(source).toMatch(
      /import\s*\{\s*handler as handleMapBackgroundImage\s*\}\s*from\s*['"]\.\.\/map-background-image\/handler\.ts['"]/
    );
  });
});
