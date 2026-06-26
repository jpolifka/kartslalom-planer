// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// Integration: Track-Lifecycle gegen echte lokale Supabase.
// create_track → save_track → fetch → fetch-by-id → delete → weg

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestUser, loginAsUser, cleanupUsers, admin,
  assertNoError, assertRpcError, ts,
} from "./helpers";

describe("Track lifecycle", () => {
  let client: Awaited<ReturnType<typeof loginAsUser>>;
  const userIds: string[] = [];
  let trackId: string;

  beforeAll(async () => {
    const email = `int-track-${ts()}@test.invalid`;
    const user = await createTestUser(email);
    userIds.push(user.id);
    client = await loginAsUser(email);
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  it("create_track gibt UUID zurück", async () => {
    const { data, error } = await client.rpc("create_track", { track_name: "Integration Test Track" });
    assertNoError(error, "create_track");
    expect(data).toMatch(/^[0-9a-f-]{36}$/);
    trackId = data as string;
  });

  it("Track erscheint in tracks-Abfrage", async () => {
    const { data, error } = await client
      .from("tracks")
      .select("id, name")
      .eq("id", trackId);
    assertNoError(error, "tracks select");
    expect(data).toHaveLength(1);
    expect(data![0].name).toBe("Integration Test Track");
  });

  it("save_track persistiert State", async () => {
    const state = {
      items: [{ id: "f1", key: "singlePylon", x: 2, y: 3, rotationDeg: 0, direction: "none" }],
      arrows: [],
    };
    const { error } = await client.rpc("save_track", {
      p_track_id:   trackId,
      p_state_json: state,
      p_area_sel:   null,
      p_width:      18,
      p_length:     36,
      p_satellite:  false,
      p_opacity:    0.5,
    });
    assertNoError(error, "save_track");
  });

  it("state_json ist nach save_track korrekt gespeichert", async () => {
    const { data, error } = await client
      .from("tracks")
      .select("state_json, manual_width, manual_length")
      .eq("id", trackId)
      .single();
    assertNoError(error, "fetch nach save");
    expect((data!.state_json as { items: unknown[] }).items).toHaveLength(1);
    expect(data!.manual_width).toBe(18);
    expect(data!.manual_length).toBe(36);
  });

  it("save_track schlägt fehl mit satellite_requires_pro für Free-User", async () => {
    const { error } = await client.rpc("save_track", {
      p_track_id:   trackId,
      p_state_json: { items: [], arrows: [] },
      p_area_sel:   null,
      p_width:      18,
      p_length:     36,
      p_satellite:  true,
      p_opacity:    0.5,
    });
    assertRpcError(error, "satellite_requires_pro", "save_track satellite");
  });

  it("delete_track entfernt den Track", async () => {
    const { error } = await client.from("tracks").delete().eq("id", trackId);
    assertNoError(error, "delete_track");
  });

  it("Track ist nach delete nicht mehr sichtbar", async () => {
    const { data, error } = await client
      .from("tracks")
      .select("id")
      .eq("id", trackId);
    assertNoError(error, "select nach delete");
    expect(data).toHaveLength(0);
  });

  it("create_track schlägt fehl nach 3 Tracks (Free-Limit)", async () => {
    // Erstelle bis zum Limit
    for (let i = 1; i <= 3; i++) {
      const { error } = await client.rpc("create_track", { track_name: `Limit-Test ${i}` });
      assertNoError(error, `create_track ${i}`);
    }
    // 4. Track muss scheitern
    const { error } = await client.rpc("create_track", { track_name: "Track 4 — zu viel" });
    assertRpcError(error, "track_limit_reached", "create_track limit");
  });
});
