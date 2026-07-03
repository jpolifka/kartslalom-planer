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

const { handler } = await import("../../supabase/functions/account-export/index.ts");

function req(headers: Record<string, string> = {}) {
  return new Request("http://fn.test/account-export", { headers });
}

function fetchOk(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

beforeEach(() => mockFetch.mockReset());

describe("account-export", () => {
  it("returns 200 for OPTIONS preflight", async () => {
    const res = await handler(new Request("http://fn.test", { method: "OPTIONS" }));
    expect(res.status).toBe(200);
  });

  it("returns 401 when Authorization header missing", async () => {
    const res = await handler(req());
    expect(res.status).toBe(401);
  });

  it("returns 401 when token validation fails", async () => {
    mockFetch.mockResolvedValueOnce(new Response("", { status: 401 }));
    const res = await handler(req({ authorization: "Bearer bad" }));
    expect(res.status).toBe(401);
  });

  it("returns export JSON with profile, tracks, and versions", async () => {
    const profile = { id: "uid-1", email: "a@b.de", tier: "free" };
    const tracks = [{ id: "t1", name: "Track 1" }];
    const versions = [{ track_id: "t1", version_number: 1 }];

    mockFetch
      .mockResolvedValueOnce(fetchOk({ id: "uid-1" }))     // /auth/v1/user
      .mockResolvedValueOnce(fetchOk([profile]))             // profiles
      .mockResolvedValueOnce(fetchOk(tracks))                // tracks
      .mockResolvedValueOnce(fetchOk(versions));             // track_versions

    const res = await handler(req({ authorization: "Bearer valid" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile).toMatchObject({ email: "a@b.de" });
    expect(body.tracks).toHaveLength(1);
    expect(body.track_versions).toHaveLength(1);
    expect(body.exported_at).toBeDefined();
  });

  it("skips versions fetch when user has no tracks", async () => {
    mockFetch
      .mockResolvedValueOnce(fetchOk({ id: "uid-1" }))
      .mockResolvedValueOnce(fetchOk([{ id: "uid-1", email: "a@b.de" }]))
      .mockResolvedValueOnce(fetchOk([])); // empty tracks

    const res = await handler(req({ authorization: "Bearer valid" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tracks).toHaveLength(0);
    expect(body.track_versions).toHaveLength(0);
    // Only 3 fetch calls (no versions call)
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("includes Content-Disposition attachment header", async () => {
    mockFetch
      .mockResolvedValueOnce(fetchOk({ id: "uid-1" }))
      .mockResolvedValueOnce(fetchOk([]))
      .mockResolvedValueOnce(fetchOk([]));

    const res = await handler(req({ authorization: "Bearer valid" }));
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment; filename=/);
  });
});
