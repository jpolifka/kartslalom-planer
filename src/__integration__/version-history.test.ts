// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// Integration: Versionshistorie (Phase 2) gegen lokale Supabase.
// create_track_version → get_track_versions → get_track_version_detail
// → restore_track_version → delete_track_version

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestUser, loginAsUser, cleanupUsers, admin,
  assertNoError, assertRpcError, ts,
} from "./helpers";

describe("Versionshistorie — Pro-User", () => {
  let client: Awaited<ReturnType<typeof loginAsUser>>;
  const userIds: string[] = [];
  let trackId: string;
  let versionId: string;

  const initialState = {
    items: [{ id: "f1", key: "singlePylon", x: 1, y: 1, rotationDeg: 0, direction: "none" }],
    arrows: [],
  };
  const modifiedState = {
    items: [{ id: "f1", key: "singlePylon", x: 9, y: 9, rotationDeg: 90, direction: "none" }],
    arrows: [],
  };

  beforeAll(async () => {
    const email = `int-version-pro-${ts()}@test.invalid`;
    const user = await createTestUser(email, "pro");
    userIds.push(user.id);
    client = await loginAsUser(email);

    // Track anlegen und initialen Zustand speichern
    const { data } = await client.rpc("create_track", { track_name: "Versions-Test" });
    trackId = data as string;
    await client.rpc("save_track", {
      p_track_id: trackId,
      p_state_json: initialState,
      p_area_sel: null,
      p_width: 18,
      p_length: 36,
      p_satellite: false,
      p_opacity: 0.5,
    });
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  it("create_track_version gibt UUID zurück", async () => {
    const { data, error } = await client.rpc("create_track_version", { p_track_id: trackId });
    assertNoError(error, "create_track_version");
    expect(data).toMatch(/^[0-9a-f-]{36}$/);
    versionId = data as string;
  });

  it("get_track_versions listet Version auf", async () => {
    const { data, error } = await client.rpc("get_track_versions", { p_track_id: trackId });
    assertNoError(error, "get_track_versions");
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
    expect(data![0].version_number).toBe(1);
    expect(data![0].id).toBe(versionId);
  });

  it("get_track_version_detail gibt state_json zurück", async () => {
    const { data, error } = await client.rpc("get_track_version_detail", { p_version_id: versionId });
    assertNoError(error, "get_track_version_detail");
    const rows = data as Array<{ version_number: number; state_json: unknown; created_at: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].version_number).toBe(1);
    expect(rows[0].state_json).toMatchObject({ items: [expect.objectContaining({ x: 1, y: 1 })] });
  });

  it("restore_track_version stellt gespeicherten Zustand wieder her", async () => {
    // Zustand überschreiben
    const { error: saveErr } = await client.rpc("save_track", {
      p_track_id: trackId,
      p_state_json: modifiedState,
      p_area_sel: null,
      p_width: 20,
      p_length: 40,
      p_satellite: false,
      p_opacity: 0.5,
    });
    assertNoError(saveErr, "save_track modifiziert");

    // Wiederherstellen
    const { error: restoreErr } = await client.rpc("restore_track_version", { p_version_id: versionId });
    assertNoError(restoreErr, "restore_track_version");

    // Track muss wieder initialen Zustand haben
    const { data: track, error: fetchErr } = await client
      .from("tracks")
      .select("state_json")
      .eq("id", trackId)
      .single();
    assertNoError(fetchErr, "fetch nach restore");
    const stateJson = track!.state_json as { items: Array<{ x: number; y: number }> };
    expect(stateJson.items[0].x).toBe(1);
    expect(stateJson.items[0].y).toBe(1);
  });

  it("zweite Version erhält version_number 2", async () => {
    await client.rpc("save_track", {
      p_track_id: trackId, p_state_json: modifiedState,
      p_area_sel: null, p_width: 18, p_length: 36, p_satellite: false, p_opacity: 0.5,
    });
    const { data, error } = await client.rpc("create_track_version", { p_track_id: trackId });
    assertNoError(error, "create_track_version 2");
    expect(data).toMatch(/^[0-9a-f-]{36}$/);

    const { data: versions } = await client.rpc("get_track_versions", { p_track_id: trackId });
    expect(versions).toHaveLength(2);
    // Absteigend sortiert — neueste zuerst
    expect(versions![0].version_number).toBe(2);
    expect(versions![1].version_number).toBe(1);
  });

  it("delete_track_version entfernt eine Version", async () => {
    const { error } = await client.rpc("delete_track_version", { p_version_id: versionId });
    assertNoError(error, "delete_track_version");

    const { data: versions } = await client.rpc("get_track_versions", { p_track_id: trackId });
    expect(versions).toHaveLength(1);
    expect(versions![0].version_number).toBe(2);
  });
});

describe("Versionshistorie — Free-User abgelehnt", () => {
  let client: Awaited<ReturnType<typeof loginAsUser>>;
  const userIds: string[] = [];
  let trackId: string;

  beforeAll(async () => {
    const email = `int-version-free-${ts()}@test.invalid`;
    const user = await createTestUser(email, "free");
    userIds.push(user.id);
    client = await loginAsUser(email);
    const { data } = await client.rpc("create_track", { track_name: "Free-Versions-Test" });
    trackId = data as string;
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  it("create_track_version schlägt für Free-User fehl", async () => {
    const { error } = await client.rpc("create_track_version", { p_track_id: trackId });
    assertRpcError(error, "version_history_requires_pro", "create_track_version free");
  });
});

describe("Versionshistorie — RLS Fremdzugriff", () => {
  let clientA: Awaited<ReturnType<typeof loginAsUser>>;
  let clientB: Awaited<ReturnType<typeof loginAsUser>>;
  const userIds: string[] = [];
  let trackIdA: string;
  let versionIdA: string;

  beforeAll(async () => {
    const emailA = `int-version-rls-a-${ts()}@test.invalid`;
    const emailB = `int-version-rls-b-${ts()}@test.invalid`;
    const userA = await createTestUser(emailA, "pro");
    const userB = await createTestUser(emailB, "pro");
    userIds.push(userA.id, userB.id);
    clientA = await loginAsUser(emailA);
    clientB = await loginAsUser(emailB);

    const { data: tid } = await clientA.rpc("create_track", { track_name: "RLS-Test-A" });
    trackIdA = tid as string;
    await clientA.rpc("save_track", {
      p_track_id: trackIdA, p_state_json: { items: [], arrows: [] },
      p_area_sel: null, p_width: 18, p_length: 36, p_satellite: false, p_opacity: 0.5,
    });
    const { data: vid } = await clientA.rpc("create_track_version", { p_track_id: trackIdA });
    versionIdA = vid as string;
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  it("User B kann keine Version für Strecke von User A anlegen", async () => {
    const { error } = await clientB.rpc("create_track_version", { p_track_id: trackIdA });
    assertRpcError(error, "not_owner", "create_track_version fremder Track");
  });

  it("User B kann Versionen von User A nicht auflisten (leeres Resultset)", async () => {
    // get_track_versions ist language sql — kein RAISE EXCEPTION, stattdessen leeres Resultset
    const { data, error } = await clientB.rpc("get_track_versions", { p_track_id: trackIdA });
    expect(error).toBeNull();
    expect(Array.isArray(data) ? data.length : 0).toBe(0);
  });

  it("User B kann Version-Detail von User A nicht lesen", async () => {
    const { data } = await clientB.rpc("get_track_version_detail", { p_version_id: versionIdA });
    // RPC gibt leeres Resultset (kein owner-Match) — kein Fehler, aber keine Daten
    expect(Array.isArray(data) ? data.length : 0).toBe(0);
  });

  it("User B kann Version von User A nicht wiederherstellen", async () => {
    const { error } = await clientB.rpc("restore_track_version", { p_version_id: versionIdA });
    assertRpcError(error, "not_owner", "restore_track_version fremde Version");
  });

  it("User B kann Version von User A nicht löschen", async () => {
    const { error } = await clientB.rpc("delete_track_version", { p_version_id: versionIdA });
    assertRpcError(error, "not_owner", "delete_track_version fremde Version");
  });
});

describe("Versionshistorie — Gleitendes Limit (Pro=10)", () => {
  let client: Awaited<ReturnType<typeof loginAsUser>>;
  const userIds: string[] = [];
  let trackId: string;

  beforeAll(async () => {
    const email = `int-version-limit-${ts()}@test.invalid`;
    const user = await createTestUser(email, "pro");
    userIds.push(user.id);
    client = await loginAsUser(email);
    const { data } = await client.rpc("create_track", { track_name: "Limit-Test" });
    trackId = data as string;
    await client.rpc("save_track", {
      p_track_id: trackId, p_state_json: { items: [], arrows: [] },
      p_area_sel: null, p_width: 18, p_length: 36, p_satellite: false, p_opacity: 0.5,
    });
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  it("nach 11 Snapshots sind weiterhin maximal 10 vorhanden (gleitendes Fenster)", async () => {
    // 11 Snapshots anlegen — das 11. soll den ältesten (version_number=1) verdrängen
    for (let i = 0; i < 11; i++) {
      const { error } = await client.rpc("create_track_version", { p_track_id: trackId });
      assertNoError(error, `Snapshot ${i + 1}`);
    }

    const { data: versions, error } = await client.rpc("get_track_versions", { p_track_id: trackId });
    assertNoError(error, "get_track_versions nach 11 Snapshots");
    expect(versions).toHaveLength(10);
    // Älteste version_number muss 2 sein (1 wurde verdrängt)
    const minNum = Math.min(...(versions as Array<{ version_number: number }>).map((v) => v.version_number));
    expect(minNum).toBe(2);
  });
});
