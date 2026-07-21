// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock("../../../lib/supabase", () => ({
  supabase: { rpc: mockRpc },
}));

import { getSharedTrack } from "../api/getSharedTrack";

function ok(data: unknown) {
  return Promise.resolve({ data, error: null });
}

function err(message: string) {
  return Promise.resolve({ data: null, error: { message } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSharedTrack", () => {
  it("calls get_track_by_share_token RPC and returns the first row", async () => {
    const row = {
      id: "t1", name: "Meine Strecke",
      state_json: { items: [], arrows: [] },
      manual_width: 18, manual_length: 36, updated_at: "2026-07-06T00:00:00Z",
    };
    mockRpc.mockResolvedValue(ok([row]));
    const result = await getSharedTrack("plaintext-token");
    expect(mockRpc).toHaveBeenCalledWith("get_track_by_share_token", { p_token: "plaintext-token" });
    expect(result.id).toBe("t1");
  });

  it("maps token_invalid error", async () => {
    mockRpc.mockResolvedValue(err("token_invalid"));
    await expect(getSharedTrack("bad-token")).rejects.toThrow("TOKEN_INVALID");
  });

  // Rate-Limit ist serverseitig pro Token/Stunde geregelt (siehe SQL-Migration
  // der RPC); dieser Test stellt nur sicher, dass der Fehlercode korrekt auf
  // einen für den UI-Layer verständlichen Fehler gemappt wird.
  it("maps rate_limit_exceeded error", async () => {
    mockRpc.mockResolvedValue(err("rate_limit_exceeded"));
    await expect(getSharedTrack("hot-token")).rejects.toThrow("RATE_LIMIT_EXCEEDED");
  });

  // Leeres Ergebnis ohne SQL-Fehler (z.B. RLS-bedingt) muss denselben
  // Fehlerfall wie ein explizit ungültiger Token auslösen.
  it("throws TOKEN_INVALID when no row is returned", async () => {
    mockRpc.mockResolvedValue(ok([]));
    await expect(getSharedTrack("x")).rejects.toThrow("TOKEN_INVALID");
  });
});
