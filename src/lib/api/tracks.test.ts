// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../supabase", () => ({
  supabase: { rpc: vi.fn() },
}));

import { supabase } from "../supabase";
import { saveTrack } from "./tracks";

const mockRpc = vi.mocked(supabase.rpc);

const minimalState = {
  items: [],
  arrows: [],
  manualWidth: 20,
  manualLength: 40,
  mapSatellite: false,
  mapOpacity: 1,
  areaSel: null,
};

beforeEach(() => vi.clearAllMocks());

describe("tracks API", () => {
  it("save uses RPC", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null } as never);
    await saveTrack("track-1", minimalState);
    expect(mockRpc).toHaveBeenCalledOnce();
    expect(mockRpc).toHaveBeenCalledWith(
      "save_track",
      expect.objectContaining({ p_track_id: "track-1" })
    );
  });

  it("error mapping", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "satellite_requires_pro" },
    } as never);
    await expect(
      saveTrack("track-1", { ...minimalState, mapSatellite: true })
    ).rejects.toThrow("SATELLITE_REQUIRES_PRO");
  });
});
