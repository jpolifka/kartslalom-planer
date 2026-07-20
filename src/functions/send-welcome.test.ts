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

  // Verhindert, dass ein alter (aber noch gültiger) Bearer-Token Monate nach
  // dem Signup erneut eine "Willkommens"-Mail auslösen kann.
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
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "uid-1" }]), { status: 200 })) // Claim erfolgreich
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "mail-1" }), { status: 200 }));

    const res = await handler(req({ authorization: "Bearer valid" }));
    const body = await res.json();
    expect(body.sent).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  // Red-Team-Review 2026-07-13 (2. Runde): ein transienter Resend-Fehler
  // (422/429/500/...) darf den Claim nicht dauerhaft "verbrennen" — sonst
  // würde jeder Wiederholungsversuch fälschlich "already_sent" melden, obwohl
  // nie eine Mail rausging. Der Claim muss zurückgerollt werden.
  it("returns 500 when Resend call fails und rollt den Claim zurück (welcome_email_sent_at=null)", async () => {
    const twoMinutes = 2 * 60 * 1000;
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(userWithAge(twoMinutes)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "uid-1" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response("error", { status: 422 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "uid-1" }]), { status: 200 })); // Rollback-PATCH

    const res = await handler(req({ authorization: "Bearer valid" }));
    expect(res.status).toBe(500);
    expect(mockFetch).toHaveBeenCalledTimes(4);

    const [rollbackUrl, rollbackInit] = mockFetch.mock.calls[3] as [string, RequestInit];
    expect(rollbackUrl).toMatch(
      /^http:\/\/supabase\.test\/rest\/v1\/profiles\?id=eq\.uid-1&welcome_email_sent_at=eq\./
    );
    expect(rollbackInit.method).toBe("PATCH");
    expect(JSON.parse(rollbackInit.body as string)).toEqual({ welcome_email_sent_at: null });
  });

  it("erlaubt nach einem zurückgerollten Claim einen erneuten, erfolgreichen Sendeversuch", async () => {
    const twoMinutes = 2 * 60 * 1000;
    // 1. Versuch: Resend schlägt fehl, Claim wird zurückgerollt.
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(userWithAge(twoMinutes)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "uid-1" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response("error", { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "uid-1" }]), { status: 200 }));
    const firstRes = await handler(req({ authorization: "Bearer valid" }));
    expect(firstRes.status).toBe(500);

    // 2. Versuch (Retry): welcome_email_sent_at ist durch den Rollback wieder
    // NULL -> Claim gelingt erneut, Resend antwortet diesmal erfolgreich.
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(userWithAge(twoMinutes)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "uid-1" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "mail-1" }), { status: 200 }));
    const secondRes = await handler(req({ authorization: "Bearer valid" }));
    const body = await secondRes.json();
    expect(body.sent).toBe(true);
  });

  // Rollback darf nur den eigenen Claim löschen (per eq.<claimedAt>-Filter in
  // der URL, siehe Test oben) -- verifiziert per Konstruktion, dass bei
  // erfolgreichem Versand GAR KEIN Rollback-Aufruf passiert (genau 3 Calls,
  // nicht 4), sonst würde ein erfolgreicher Claim fälschlich gelöscht.
  it("rollt den Claim NICHT zurück wenn Resend erfolgreich war", async () => {
    const twoMinutes = 2 * 60 * 1000;
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(userWithAge(twoMinutes)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "uid-1" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "mail-1" }), { status: 200 }));

    await handler(req({ authorization: "Bearer valid" }));
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  // Red-Team-Review 2026-07-13: wiederholte Aufrufe innerhalb der 5-Minuten-
  // Frist dürfen nur einmal eine Mail auslösen (welcome_email_sent_at-Claim).
  it("skips mail when welcome_email_sent_at is already claimed (repeat call)", async () => {
    const twoMinutes = 2 * 60 * 1000;
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(userWithAge(twoMinutes)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 })); // 0 Zeilen -> bereits geclaimt

    const res = await handler(req({ authorization: "Bearer valid" }));
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe("already_sent");
    expect(mockFetch).toHaveBeenCalledTimes(2); // kein Resend-Aufruf
  });

  it("returns 500 when the claim PATCH itself fails", async () => {
    const twoMinutes = 2 * 60 * 1000;
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(userWithAge(twoMinutes)), { status: 200 }))
      .mockResolvedValueOnce(new Response("db error", { status: 500 }));

    const res = await handler(req({ authorization: "Bearer valid" }));
    expect(res.status).toBe(500);
    expect(mockFetch).toHaveBeenCalledTimes(2); // kein Resend-Aufruf
  });

  it("PATCHed an den erwarteten profiles-Endpunkt mit welcome_email_sent_at=is.null Filter", async () => {
    const twoMinutes = 2 * 60 * 1000;
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(userWithAge(twoMinutes)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "uid-1" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "mail-1" }), { status: 200 }));

    await handler(req({ authorization: "Bearer valid" }));

    const [claimUrl, claimInit] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(claimUrl).toBe(
      "http://supabase.test/rest/v1/profiles?id=eq.uid-1&welcome_email_sent_at=is.null"
    );
    expect(claimInit.method).toBe("PATCH");
  });
});
