// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();

vi.stubGlobal("Deno", {
  env: {
    get: (key: string) =>
      ({
        SUPABASE_URL: "http://supabase.test",
        SUPABASE_SERVICE_ROLE_KEY: "svc-key",
        RESEND_API_KEY: "resend-key",
        FROM_EMAIL: "test@example.com",
      })[key],
  },
  serve: vi.fn(),
});
vi.stubGlobal("fetch", mockFetch);

const { handler } = await import("../../supabase/functions/send-welcome/index.ts");

function req(headers: Record<string, string> = {}) {
  return new Request("http://fn.test/send-welcome", { headers });
}

function userWithAge(ageMs: number) {
  return { id: "uid-1", email: "a@b.de", created_at: new Date(Date.now() - ageMs).toISOString() };
}

beforeEach(() => mockFetch.mockReset());

describe("send-welcome", () => {
  it("returns 401 when Authorization header missing", async () => {
    const res = await handler(req());
    expect(res.status).toBe(401);
  });

  it("returns 401 when token validation fails", async () => {
    mockFetch.mockResolvedValueOnce(new Response("", { status: 401 }));
    const res = await handler(req({ authorization: "Bearer bad" }));
    expect(res.status).toBe(401);
  });

  it("skips mail for account older than 5 minutes", async () => {
    const sixMinutes = 6 * 60 * 1000;
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(userWithAge(sixMinutes)), { status: 200 })
    );
    const res = await handler(req({ authorization: "Bearer valid" }));
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe("account_not_new");
    expect(mockFetch).toHaveBeenCalledTimes(1); // only token check, no mail
  });

  it("sends welcome mail for new account (< 5 min)", async () => {
    const twoMinutes = 2 * 60 * 1000;
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(userWithAge(twoMinutes)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "mail-1" }), { status: 200 }));

    const res = await handler(req({ authorization: "Bearer valid" }));
    const body = await res.json();
    expect(body.sent).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns 500 when Resend call fails", async () => {
    const twoMinutes = 2 * 60 * 1000;
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(userWithAge(twoMinutes)), { status: 200 }))
      .mockResolvedValueOnce(new Response("error", { status: 422 }));

    const res = await handler(req({ authorization: "Bearer valid" }));
    expect(res.status).toBe(500);
  });
});
