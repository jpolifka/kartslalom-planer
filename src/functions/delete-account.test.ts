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

  // Erfolgsfall: validate → RPC cleanup → auth delete
  it("returns 200 and { deleted: true } on success", async () => {
    mockFetch
      .mockResolvedValueOnce(fetchOk({ id: "uid-1" }))   // /auth/v1/user
      .mockResolvedValueOnce(fetchOk({}))                  // RPC delete_account_data
      .mockResolvedValueOnce(fetchOk({}, 200));             // auth.admin.deleteUser

    const res = await handler(req("POST", { authorization: "Bearer valid" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ deleted: true });
  });

  // RPC-Fehlschlag: DB-Bereinigung schlägt fehl — kein Auth-Delete
  it("returns 500 when RPC cleanup fails, does not attempt auth delete", async () => {
    mockFetch
      .mockResolvedValueOnce(fetchOk({ id: "uid-1" }))                    // validate
      .mockResolvedValueOnce(new Response("rpc error", { status: 500 })); // RPC fehlschlägt

    const res = await handler(req("POST", { authorization: "Bearer valid" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "cleanup_failed" });
    expect(mockFetch).toHaveBeenCalledTimes(2); // kein dritter Call (auth delete)
  });

  // Auth-Delete-Fehlschlag: Soft-Delete wird rückgängig gemacht
  it("rolls back soft-delete and returns 500 when auth delete fails", async () => {
    mockFetch
      .mockResolvedValueOnce(fetchOk({ id: "uid-1" }))                    // validate
      .mockResolvedValueOnce(fetchOk({}))                                   // RPC cleanup OK
      .mockResolvedValueOnce(new Response("fail", { status: 500 }))        // auth delete fehlschlägt
      .mockResolvedValueOnce(fetchOk({}));                                  // rollback PATCH

    const res = await handler(req("POST", { authorization: "Bearer valid" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "delete_failed" });

    // Rollback-Call prüfen: 4. Fetch muss is_deleted=false setzen
    expect(mockFetch).toHaveBeenCalledTimes(4);
    const rollbackCall = mockFetch.mock.calls[3];
    const rollbackBody = JSON.parse(rollbackCall[1].body);
    expect(rollbackBody.is_deleted).toBe(false);
    expect(rollbackBody.deleted_at).toBeNull();
  });

  // RPC wird mit User-Bearer aufgerufen (für auth.uid() im SECURITY DEFINER RPC).
  // Das ist der zentrale Anti-IDOR-Mechanismus dieser Function: es gibt
  // keinen Test dafür, dass "ein fremdes Konto per User-ID-Parameter gelöscht
  // werden kann", weil es diesen Parameter im Handler schlicht nicht gibt --
  // die uid kommt ausschließlich aus dem verifizierten Token (siehe
  // handler.ts). Dieser Test verifiziert indirekt, dass genau dieser Bearer
  // (und nicht der Service-Role-Key) an die RPC weitergereicht wird, damit
  // auth.uid() im SECURITY-DEFINER-Kontext korrekt auf den Aufrufer zeigt.
  it("calls RPC with user bearer token, not service role", async () => {
    mockFetch
      .mockResolvedValueOnce(fetchOk({ id: "uid-1" }))
      .mockResolvedValueOnce(fetchOk({}))
      .mockResolvedValueOnce(fetchOk({}));

    await handler(req("POST", { authorization: "Bearer user-jwt" }));

    const rpcCall = mockFetch.mock.calls[1];
    expect(rpcCall[0]).toContain("/rpc/delete_account_data");
    expect(rpcCall[1].headers["Authorization"]).toBe("Bearer user-jwt");
  });
});
