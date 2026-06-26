// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// Integration: RLS-Isolation — User A kann Daten von User B nicht lesen oder schreiben.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createTestUser, loginAsUser, cleanupUsers,
  assertNoError, assertRpcError, ts,
} from "./helpers";

describe("RLS isolation (Tracks)", () => {
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  const userIds: string[] = [];
  let trackAId: string;

  beforeAll(async () => {
    const t = ts();
    const [userA, userB] = await Promise.all([
      createTestUser(`int-rls-a-${t}@test.invalid`),
      createTestUser(`int-rls-b-${t}@test.invalid`),
    ]);
    userIds.push(userA.id, userB.id);
    [clientA, clientB] = await Promise.all([
      loginAsUser(`int-rls-a-${t}@test.invalid`),
      loginAsUser(`int-rls-b-${t}@test.invalid`),
    ]);

    const { data, error } = await clientA.rpc("create_track", { track_name: "User-A Track" });
    assertNoError(error, "create_track A");
    trackAId = data as string;
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  it("User A sieht eigenen Track", async () => {
    const { data, error } = await clientA.from("tracks").select("id").eq("id", trackAId);
    assertNoError(error, "A sieht eigenen Track");
    expect(data).toHaveLength(1);
  });

  it("User B sieht Track von User A nicht", async () => {
    const { data, error } = await clientB.from("tracks").select("id").eq("id", trackAId);
    assertNoError(error, "B liest Tracks");
    expect(data).toHaveLength(0);
  });

  it("User B kann nicht via save_track auf Track von A schreiben", async () => {
    const { error } = await clientB.rpc("save_track", {
      p_track_id:   trackAId,
      p_state_json: { items: [], arrows: [] },
      p_area_sel:   null,
      p_width:      18,
      p_length:     36,
      p_satellite:  false,
      p_opacity:    0.5,
    });
    assertRpcError(error, "not_owner", "B save auf Track A");
  });

  it("User B kann Track von A nicht direkt löschen", async () => {
    // RLS blockiert DELETE — kein Fehler, aber 0 Rows affected
    const { error } = await clientB.from("tracks").delete().eq("id", trackAId);
    assertNoError(error, "B delete Track A (RLS silent)");
    // Track muss noch existieren für User A
    const { data } = await clientA.from("tracks").select("id").eq("id", trackAId);
    expect(data).toHaveLength(1);
  });

  it("direktes INSERT auf tracks ist gesperrt", async () => {
    const { error } = await clientA
      .from("tracks")
      .insert({ name: "Direct Insert", owner_id: userIds[0] });
    expect(error).not.toBeNull();
  });
});
