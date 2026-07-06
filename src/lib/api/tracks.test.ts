// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("../supabase", () => ({
  supabase: { rpc: mockRpc, from: mockFrom },
}));

import { saveTrack, fetchTracks, fetchTrack, createTrack, renameTrack, deleteTrack, createTrackFromVersion, createTrackShareLink, revokeTrackShareLink } from "./tracks";

const minimalState = {
  items: [],
  arrows: [],
  manualWidth: 20,
  manualLength: 40,
  mapSatellite: false,
  mapOpacity: 1,
  areaSel: null,
};

function ok(data: unknown = null) {
  return Promise.resolve({ data, error: null });
}

function err(message: string) {
  return Promise.resolve({ data: null, error: { message } });
}

/** Builder für Supabase-Chaining.
 *  eq() gibt ein Thenable zurück das auch .single() hat — damit funktioniert
 *  sowohl `await from().delete().eq()` als auch `await from().select().eq().single()`.
 */
function chain(terminal: Promise<unknown>) {
  const eqResult = Object.assign(Promise.resolve(terminal).then((v) => v), {
    single:      () => terminal,
    maybeSingle: () => terminal,
  });
  const c = {
    select:      () => c,
    delete:      () => c,
    order:       () => terminal,
    eq:          () => eqResult,
    single:      () => terminal,
    maybeSingle: () => terminal,
  };
  return c;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRpc.mockResolvedValue({ data: null, error: null });
});

describe("saveTrack", () => {
  it("calls save_track RPC with correct params", async () => {
    await saveTrack("track-1", minimalState);
    expect(mockRpc).toHaveBeenCalledWith("save_track", expect.objectContaining({ p_track_id: "track-1" }));
  });

  it("maps satellite_requires_pro error", async () => {
    mockRpc.mockResolvedValue(err("satellite_requires_pro"));
    await expect(saveTrack("t", { ...minimalState, mapSatellite: true })).rejects.toThrow("SATELLITE_REQUIRES_PRO");
  });

  it("maps not_owner error", async () => {
    mockRpc.mockResolvedValue(err("not_owner"));
    await expect(saveTrack("t", minimalState)).rejects.toThrow("NOT_OWNER");
  });

  it("rethrows unknown errors", async () => {
    mockRpc.mockResolvedValue(err("something_else"));
    await expect(saveTrack("t", minimalState)).rejects.toMatchObject({ message: "something_else" });
  });
});

describe("createTrack", () => {
  it("returns new track id", async () => {
    mockRpc.mockResolvedValue(ok("new-id"));
    expect(await createTrack()).toBe("new-id");
  });

  it("maps track_limit_reached error", async () => {
    mockRpc.mockResolvedValue(err("track_limit_reached"));
    await expect(createTrack()).rejects.toThrow("TRACK_LIMIT_REACHED");
  });

  it("maps invalid_name error", async () => {
    mockRpc.mockResolvedValue(err("invalid_name"));
    await expect(createTrack()).rejects.toThrow("INVALID_NAME");
  });

  it("rethrows unknown errors", async () => {
    mockRpc.mockResolvedValue(err("db_error"));
    await expect(createTrack()).rejects.toMatchObject({ message: "db_error" });
  });
});

describe("createTrackFromVersion", () => {
  it("calls create_track_from_version RPC with correct params and returns new id", async () => {
    mockRpc.mockResolvedValue(ok("new-track-id"));
    const result = await createTrackFromVersion("version-1", "Kopie");
    expect(result).toBe("new-track-id");
    expect(mockRpc).toHaveBeenCalledWith("create_track_from_version", {
      p_version_id: "version-1",
      p_name: "Kopie",
    });
  });

  it("maps track_limit_reached error", async () => {
    mockRpc.mockResolvedValue(err("track_limit_reached"));
    await expect(createTrackFromVersion("v", "n")).rejects.toThrow("TRACK_LIMIT_REACHED");
  });

  it("maps satellite_requires_pro error", async () => {
    mockRpc.mockResolvedValue(err("satellite_requires_pro"));
    await expect(createTrackFromVersion("v", "n")).rejects.toThrow("SATELLITE_REQUIRES_PRO");
  });

  it("maps not_owner error", async () => {
    mockRpc.mockResolvedValue(err("not_owner"));
    await expect(createTrackFromVersion("v", "n")).rejects.toThrow("NOT_OWNER");
  });

  it("maps invalid_name error", async () => {
    mockRpc.mockResolvedValue(err("invalid_name"));
    await expect(createTrackFromVersion("v", "n")).rejects.toThrow("INVALID_NAME");
  });

  it("rethrows unknown errors", async () => {
    mockRpc.mockResolvedValue(err("db_error"));
    await expect(createTrackFromVersion("v", "n")).rejects.toMatchObject({ message: "db_error" });
  });
});

describe("renameTrack", () => {
  it("calls rename_track RPC", async () => {
    await renameTrack("t", "Neuer Name");
    expect(mockRpc).toHaveBeenCalledWith("rename_track", { p_track_id: "t", p_name: "Neuer Name" });
  });

  it("trims whitespace before calling RPC", async () => {
    await renameTrack("t", "  Trimmed  ");
    expect(mockRpc).toHaveBeenCalledWith("rename_track", expect.objectContaining({ p_name: "Trimmed" }));
  });

  it("does nothing for empty name", async () => {
    await renameTrack("t", "   ");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("maps not_owner error", async () => {
    mockRpc.mockResolvedValue(err("not_owner"));
    await expect(renameTrack("t", "X")).rejects.toThrow("NOT_OWNER");
  });

  it("maps invalid_name error", async () => {
    mockRpc.mockResolvedValue(err("invalid_name"));
    await expect(renameTrack("t", "X")).rejects.toThrow("INVALID_NAME");
  });
});

describe("createTrackShareLink", () => {
  it("calls create_track_share_link RPC and returns the plaintext token", async () => {
    mockRpc.mockResolvedValue(ok("plaintext-token"));
    const token = await createTrackShareLink("t1");
    expect(mockRpc).toHaveBeenCalledWith("create_track_share_link", { p_track_id: "t1" });
    expect(token).toBe("plaintext-token");
  });

  it("maps share_requires_pro error", async () => {
    mockRpc.mockResolvedValue(err("share_requires_pro"));
    await expect(createTrackShareLink("t1")).rejects.toThrow("SHARE_REQUIRES_PRO");
  });

  it("maps not_owner error", async () => {
    mockRpc.mockResolvedValue(err("not_owner"));
    await expect(createTrackShareLink("t1")).rejects.toThrow("NOT_OWNER");
  });

  it("maps account_deleted error", async () => {
    mockRpc.mockResolvedValue(err("account_deleted"));
    await expect(createTrackShareLink("t1")).rejects.toThrow("ACCOUNT_DELETED");
  });
});

describe("revokeTrackShareLink", () => {
  it("calls revoke_track_share_link RPC", async () => {
    await revokeTrackShareLink("t1");
    expect(mockRpc).toHaveBeenCalledWith("revoke_track_share_link", { p_track_id: "t1" });
  });

  it("maps not_owner error", async () => {
    mockRpc.mockResolvedValue(err("not_owner"));
    await expect(revokeTrackShareLink("t1")).rejects.toThrow("NOT_OWNER");
  });
});

describe("fetchTracks", () => {
  it("returns track list", async () => {
    const tracks = [{ id: "t1", name: "Track 1", updated_at: "", manual_width: 18, manual_length: 36 }];
    mockFrom.mockReturnValue(chain(ok(tracks)));
    const result = await fetchTracks();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t1");
  });

  it("throws on error", async () => {
    mockFrom.mockReturnValue(chain(Promise.resolve({ data: null, error: { message: "db" } })));
    await expect(fetchTracks()).rejects.toMatchObject({ message: "db" });
  });
});

describe("fetchTrack", () => {
  it("returns track detail", async () => {
    const track = { id: "t1", name: "T", state_json: { items: [], arrows: [] } };
    mockFrom.mockReturnValue(chain(ok(track)));
    const result = await fetchTrack("t1");
    expect(result?.id).toBe("t1");
  });

  it("returns null when no row (RLS blocked)", async () => {
    mockFrom.mockReturnValue(chain(ok(null)));
    const result = await fetchTrack("foreign-id");
    expect(result).toBeNull();
  });

  it("throws on error", async () => {
    mockFrom.mockReturnValue(chain(Promise.resolve({ data: null, error: { message: "not found" } })));
    await expect(fetchTrack("x")).rejects.toMatchObject({ message: "not found" });
  });
});

describe("deleteTrack", () => {
  it("calls from().delete().eq()", async () => {
    mockFrom.mockReturnValue(chain(ok()));
    await deleteTrack("t1");
    expect(mockFrom).toHaveBeenCalledWith("tracks");
  });

  it("throws on error", async () => {
    mockFrom.mockReturnValue(chain(Promise.resolve({ data: null, error: { message: "err" } })));
    await expect(deleteTrack("t1")).rejects.toMatchObject({ message: "err" });
  });
});
