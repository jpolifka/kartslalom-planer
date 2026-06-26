// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub Deno global before importing the function module
const mockFetch = vi.fn();

vi.stubGlobal("Deno", {
  env: {
    get: (key: string) =>
      ({ SUPABASE_URL: "http://supabase.test", SUPABASE_SERVICE_ROLE_KEY: "svc-key" })[key],
  },
  serve: vi.fn(),
});
vi.stubGlobal("fetch", mockFetch);

const { handler } = await import("../../supabase/functions/delete-account/index.ts");

function req(method = "POST", headers: Record<string, string> = {}) {
  return new Request("http://fn.test/delete-account", { method, headers });
}

function fetchOk(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

beforeEach(() => mockFetch.mockReset());

describe("delete-account", () => {
  it("returns 200 CORS preflight for OPTIONS", async () => {
    const res = await handler(req("OPTIONS"));
    expect(res.status).toBe(200);
  });

  it("returns 405 for GET", async () => {
    const res = await handler(req("GET"));
    expect(res.status).toBe(405);
  });

  it("returns 401 when Authorization header missing", async () => {
    const res = await handler(req("POST"));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "Unauthorized" });
  });

  it("returns 401 when token is invalid", async () => {
    mockFetch.mockResolvedValueOnce(new Response("", { status: 401 }));
    const res = await handler(req("POST", { authorization: "Bearer bad" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "Invalid token" });
  });

  it("returns 200 and { deleted: true } on success", async () => {
    mockFetch
      .mockResolvedValueOnce(fetchOk({ id: "uid-1" }))   // /auth/v1/user
      .mockResolvedValueOnce(fetchOk({}))                  // PATCH soft-delete
      .mockResolvedValueOnce(fetchOk({}, 200));             // DELETE hard-delete

    const res = await handler(req("POST", { authorization: "Bearer valid" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ deleted: true });
  });

  it("rolls back soft-delete and returns 500 when hard-delete fails", async () => {
    mockFetch
      .mockResolvedValueOnce(fetchOk({ id: "uid-1" }))        // /auth/v1/user
      .mockResolvedValueOnce(fetchOk({}))                      // PATCH soft-delete
      .mockResolvedValueOnce(new Response("fail", { status: 500 })) // DELETE fails
      .mockResolvedValueOnce(fetchOk({}));                     // PATCH rollback

    const res = await handler(req("POST", { authorization: "Bearer valid" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "delete_failed" });

    // Verify rollback call: 4th fetch should patch is_deleted=false
    const rollbackCall = mockFetch.mock.calls[3];
    const rollbackBody = JSON.parse(rollbackCall[1].body);
    expect(rollbackBody.is_deleted).toBe(false);
    expect(rollbackBody.deleted_at).toBeNull();
  });
});
