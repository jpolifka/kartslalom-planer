// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

// Contract-Test gegen Konfig-Drift: RLP-DOP20-URL/Layer/Version/Coverage
// sind bewusst dupliziert (Edge Functions importieren keinen App-Code, siehe
// Kommentare in mapProviders.ts / map-background-image/index.ts). Dieser
// Test stellt sicher, dass ein künftiger Wert-Wechsel (z. B. neue Coverage-
// BBox oder Endpoint-URL) nicht nur an einer Stelle landet.

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

  it("supabase/functions/main/index.ts (lokaler Docker-Dispatcher, Duplikat) stimmt mit mapProviders.ts überein", () => {
    // main/index.ts importiert u. a. ein Remote-HTTPS-Modul (jose) und ruft
    // beim Laden Deno.serve() sowie Deno.env.get(...)! auf — direkter Import
    // in vitest wäre unverhältnismäßig aufwändig. Stattdessen die
    // MBI_PROVIDERS-Werte per Regex aus dem Quelltext extrahieren (robust
    // gegen Anführungszeichen-Stil/Whitespace, fängt aber echten Werte-Drift).
    const mainPath = join(process.cwd(), "supabase/functions/main/index.ts");
    const source = readFileSync(mainPath, "utf-8");

    const mbiSectionMatch = source.match(/const MBI_PROVIDERS[\s\S]*?\n}\n/);
    expect(mbiSectionMatch, "MBI_PROVIDERS-Block nicht gefunden — main/index.ts umstrukturiert?").toBeTruthy();
    const mbiSection = mbiSectionMatch![0];

    const extractString = (field: string): string | null =>
      mbiSection.match(new RegExp(`${field}:\\s*['"]([^'"]*)['"]`))?.[1] ?? null;
    const extractNumber = (field: string): number =>
      Number(mbiSection.match(new RegExp(`${field}:\\s*(-?[\\d.]+)`))?.[1]);

    expect(extractString("baseUrl")).toBe(appWms.baseUrl);
    expect(extractString("layers")).toBe(appWms.layers);
    expect(extractString("format")).toBe(appWms.format);
    expect(extractString("version")).toBe(appWms.version);
    expect(extractNumber("west")).toBe(appCoverage.west);
    expect(extractNumber("south")).toBe(appCoverage.south);
    expect(extractNumber("east")).toBe(appCoverage.east);
    expect(extractNumber("north")).toBe(appCoverage.north);
  });
});
