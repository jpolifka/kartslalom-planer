// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
const CRON_SECRET = "test-cron-secret";

vi.stubGlobal("Deno", {
  env: {
    get: (key: string) =>
      ({
        SUPABASE_URL: "http://supabase.test",
        SUPABASE_SERVICE_ROLE_KEY: "svc-key",
        RESEND_API_KEY: "resend-key",
        FROM_EMAIL: "test@example.com",
        CRON_SECRET,
      })[key],
  },
  serve: vi.fn(),
});
vi.stubGlobal("fetch", mockFetch);

const { handler } = await import("../../supabase/functions/user-lifecycle/index.ts");

function req(secret = CRON_SECRET) {
  return new Request("http://fn.test/user-lifecycle", {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });
}

function fetchOk(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

beforeEach(() => mockFetch.mockReset());

describe("user-lifecycle", () => {
  it("returns 200 for OPTIONS preflight", async () => {
    const res = await handler(new Request("http://fn.test", { method: "OPTIONS" }));
    expect(res.status).toBe(200);
  });

  // Diese Function hat keine User-Auth (kein Bearer-Token) -- CRON_SECRET
  // ist die einzige Zugriffskontrolle. Ohne sie könnte jeder unauthentifiziert
  // Massen-Soft-Deletes und Massen-Mails auslösen (siehe handler.ts).
  it("returns 403 when cron secret is wrong", async () => {
    const res = await handler(req("wrong-secret"));
    expect(res.status).toBe(403);
  });

  it("returns 403 when x-cron-secret header is missing", async () => {
    const res = await handler(new Request("http://fn.test/user-lifecycle"));
    expect(res.status).toBe(403);
  });

  it("processes lifecycle with no users in any bucket", async () => {
    mockFetch
      .mockResolvedValueOnce(fetchOk([]))   // 180d soft-delete candidates
      .mockResolvedValueOnce(fetchOk([]))   // 170d warning candidates
      .mockResolvedValueOnce(fetchOk([]));  // 150d warning candidates

    const res = await handler(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.stats).toEqual({ reminder150: 0, reminder170: 0, softDeleted: 0, errors: 0 });
  });

  it("soft-deletes inactive users (180+ days) and sends mail", async () => {
    const inactiveUser = { id: "uid-old", email: "old@test.de" };
    mockFetch
      .mockResolvedValueOnce(fetchOk([inactiveUser]))          // 180d → soft-delete
      .mockResolvedValueOnce(fetchOk({}))                      // PATCH is_deleted
      .mockResolvedValueOnce(fetchOk({ id: "mail-1" }))        // Resend mail
      .mockResolvedValueOnce(fetchOk([]))                      // 170d → empty
      .mockResolvedValueOnce(fetchOk([]));                     // 150d → empty

    const res = await handler(req());
    const body = await res.json();
    expect(body.stats.softDeleted).toBe(1);
    expect(body.stats.reminder150).toBe(0);
  });

  it("sends 170-day reminder and patches profile", async () => {
    const user = { id: "uid-170", email: "warn@test.de" };
    mockFetch
      .mockResolvedValueOnce(fetchOk([]))                      // 180d → empty
      .mockResolvedValueOnce(fetchOk([user]))                  // 170d → 1 user
      .mockResolvedValueOnce(fetchOk({ id: "mail-1" }))        // Resend mail sent
      .mockResolvedValueOnce(fetchOk({}))                      // PATCH reminder_170_sent_at
      .mockResolvedValueOnce(fetchOk([]));                     // 150d → empty

    const res = await handler(req());
    const body = await res.json();
    expect(body.stats.reminder170).toBe(1);
    expect(body.stats.errors).toBe(0);
  });

  it("counts error when reminder mail fails", async () => {
    const user = { id: "uid-150", email: "warn@test.de" };
    mockFetch
      .mockResolvedValueOnce(fetchOk([]))                              // 180d → empty
      .mockResolvedValueOnce(fetchOk([]))                              // 170d → empty
      .mockResolvedValueOnce(fetchOk([user]))                          // 150d → 1 user
      .mockResolvedValueOnce(new Response("fail", { status: 422 }));  // Resend fails

    const res = await handler(req());
    const body = await res.json();
    expect(body.stats.reminder150).toBe(0);
    expect(body.stats.errors).toBe(1);
  });
});
