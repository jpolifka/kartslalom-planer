// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();

vi.stubGlobal("Deno", {
  env: {
    get: (key: string) =>
      ({ SUPABASE_URL: "http://supabase.test", SUPABASE_SERVICE_ROLE_KEY: "svc-key" })[key],
  },
  serve: vi.fn(),
});
vi.stubGlobal("fetch", mockFetch);

const { handler } = await import("../../supabase/functions/map-background-image/index.ts");

// Bbox innerhalb der RLP-DOP20-Abdeckung (rund um lng≈8.0/lat≈50.0)
const INSIDE_BBOX = [879423.98, 6428975.58, 901687.88, 6463612.12];
// Bbox weit außerhalb (Berlin-Bereich)
const OUTSIDE_BBOX = [1480549.23, 6872776.25, 1502813.13, 6909348.79];

function req(body?: unknown, headers: Record<string, string> = {}, method = "POST") {
  return new Request("http://fn.test/map-background-image", {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function authedReq(body: unknown) {
  return req(body, { authorization: "Bearer valid" });
}

function fetchOk(body: unknown, init: ResponseInit = {}) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200, ...init }));
}

function mockAuthAndProfile(tier: "free" | "pro" | "team", isDeleted = false) {
  mockFetch
    .mockResolvedValueOnce(fetchOk({ id: "uid-1" })) // /auth/v1/user
    .mockResolvedValueOnce(fetchOk([{ tier, is_deleted: isDeleted }])); // profiles
}

beforeEach(() => mockFetch.mockReset());

describe("map-background-image", () => {
  it("returns 200 for OPTIONS preflight", async () => {
    const res = await handler(new Request("http://fn.test", { method: "OPTIONS" }));
    expect(res.status).toBe(200);
  });

  it("returns 405 for GET", async () => {
    const res = await handler(req(undefined, {}, "GET"));
    expect(res.status).toBe(405);
  });

  it("returns 401 when Authorization header missing", async () => {
    const res = await handler(req({}));
    expect(res.status).toBe(401);
  });

  it("returns 401 when token validation fails", async () => {
    mockFetch.mockResolvedValueOnce(new Response("", { status: 401 }));
    const res = await handler(authedReq({}));
    expect(res.status).toBe(401);
  });

  it("returns 401 when account is soft-deleted", async () => {
    mockAuthAndProfile("pro", true);
    const res = await handler(authedReq({ providerId: "rlp_dop20", bbox: INSIDE_BBOX, width: 100, height: 100 }));
    expect(res.status).toBe(401);
  });

  it("returns 403 premium_required for Free-Tier", async () => {
    mockAuthAndProfile("free");
    const res = await handler(authedReq({ providerId: "rlp_dop20", bbox: INSIDE_BBOX, width: 100, height: 100 }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("premium_required");
  });

  it("returns 400 unknown_provider für nicht registrierte Provider-IDs", async () => {
    mockAuthAndProfile("pro");
    const res = await handler(authedReq({ providerId: "not-a-real-provider", bbox: INSIDE_BBOX, width: 100, height: 100 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("unknown_provider");
  });

  it("akzeptiert keine beliebige URL statt providerId (SSRF-Schutz)", async () => {
    mockAuthAndProfile("pro");
    const res = await handler(
      authedReq({ providerId: "https://evil.example/", bbox: INSIDE_BBOX, width: 100, height: 100 })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("unknown_provider");
  });

  it("returns 400 invalid_bbox bei falscher Bbox-Form", async () => {
    mockAuthAndProfile("pro");
    const res = await handler(authedReq({ providerId: "rlp_dop20", bbox: [1, 2, 3], width: 100, height: 100 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_bbox");
  });

  it("returns 400 invalid_bbox wenn min >= max", async () => {
    mockAuthAndProfile("pro");
    const res = await handler(authedReq({ providerId: "rlp_dop20", bbox: [100, 100, 50, 200], width: 100, height: 100 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_bbox");
  });

  it("returns 400 bbox_outside_coverage außerhalb Rheinland-Pfalz", async () => {
    mockAuthAndProfile("pro");
    const res = await handler(authedReq({ providerId: "rlp_dop20", bbox: OUTSIDE_BBOX, width: 100, height: 100 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("bbox_outside_coverage");
  });

  it("returns 400 invalid_dimensions bei zu großer Breite/Höhe", async () => {
    mockAuthAndProfile("pro");
    const res = await handler(authedReq({ providerId: "rlp_dop20", bbox: INSIDE_BBOX, width: 5000, height: 100 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_dimensions");
  });

  it("returns 400 invalid_dimensions wenn width*height das Pixel-Limit überschreitet", async () => {
    mockAuthAndProfile("pro");
    const res = await handler(authedReq({ providerId: "rlp_dop20", bbox: INSIDE_BBOX, width: 3000, height: 3000 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_dimensions");
  });

  it("returns 400 invalid_dimensions bei negativer/Null Breite", async () => {
    mockAuthAndProfile("pro");
    const res = await handler(authedReq({ providerId: "rlp_dop20", bbox: INSIDE_BBOX, width: 0, height: 100 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_dimensions");
  });

  it("liefert das Bild mit korrektem Content-Type für gültige Pro-Anfrage", async () => {
    mockAuthAndProfile("pro");
    const fakeImageBytes = new Uint8Array([1, 2, 3, 4]);
    mockFetch.mockResolvedValueOnce(
      new Response(fakeImageBytes, { status: 200, headers: { "content-type": "image/jpeg" } })
    );

    const res = await handler(authedReq({ providerId: "rlp_dop20", bbox: INSIDE_BBOX, width: 600, height: 580 }));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(buf)).toEqual([1, 2, 3, 4]);

    // Die tatsächlich angefragte WMS-URL prüfen (kein Client-Passthrough einer URL)
    const wmsCallUrl = mockFetch.mock.calls[2][0] as string;
    expect(wmsCallUrl).toContain("geo4.service24.rlp.de/wms/rp_dop20.fcgi");
    expect(wmsCallUrl).toContain("SERVICE=WMS");
    expect(wmsCallUrl).toContain("WIDTH=600");
    expect(wmsCallUrl).toContain("HEIGHT=580");
  });

  it("liefert Team-Tarif ebenfalls ein Bild (nicht nur Pro)", async () => {
    mockAuthAndProfile("team");
    mockFetch.mockResolvedValueOnce(
      new Response(new Uint8Array([9]), { status: 200, headers: { "content-type": "image/jpeg" } })
    );
    const res = await handler(authedReq({ providerId: "rlp_dop20", bbox: INSIDE_BBOX, width: 100, height: 100 }));
    expect(res.status).toBe(200);
  });

  it("returns 502 upstream_error wenn der WMS-Dienst fehlschlägt", async () => {
    mockAuthAndProfile("pro");
    mockFetch.mockResolvedValueOnce(new Response("", { status: 500 }));
    const res = await handler(authedReq({ providerId: "rlp_dop20", bbox: INSIDE_BBOX, width: 100, height: 100 }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("upstream_error");
  });

  it("returns 504 upstream_timeout wenn der WMS-Dienst nicht rechtzeitig antwortet", async () => {
    vi.useFakeTimers();
    try {
      mockAuthAndProfile("pro");
      mockFetch.mockImplementationOnce((_url: string, init?: { signal?: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      });
      const resPromise = handler(authedReq({ providerId: "rlp_dop20", bbox: INSIDE_BBOX, width: 100, height: 100 }));
      await vi.advanceTimersByTimeAsync(10_000);
      const res = await resPromise;
      expect(res.status).toBe(504);
      expect((await res.json()).error).toBe("upstream_timeout");
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns 502 invalid_upstream_response bei Nicht-Bild-Content-Type trotz HTTP 200", async () => {
    mockAuthAndProfile("pro");
    mockFetch.mockResolvedValueOnce(
      new Response("<ServiceExceptionReport/>", { status: 200, headers: { "content-type": "text/xml" } })
    );
    const res = await handler(authedReq({ providerId: "rlp_dop20", bbox: INSIDE_BBOX, width: 100, height: 100 }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("invalid_upstream_response");
  });

  it("returns 502 upstream_response_too_large wenn Content-Length das Limit überschreitet", async () => {
    mockAuthAndProfile("pro");
    mockFetch.mockResolvedValueOnce(
      new Response(new Uint8Array([1]), {
        status: 200,
        headers: { "content-type": "image/jpeg", "content-length": String(20 * 1024 * 1024) },
      })
    );
    const res = await handler(authedReq({ providerId: "rlp_dop20", bbox: INSIDE_BBOX, width: 100, height: 100 }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("upstream_response_too_large");
  });
});
