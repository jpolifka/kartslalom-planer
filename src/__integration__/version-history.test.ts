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

  it("restore_track_version stellt gespeicherten Zustand wieder her — alle Felder", async () => {
    // Zustand mit anderen Werten überschreiben
    const { error: saveErr } = await client.rpc("save_track", {
      p_track_id: trackId,
      p_state_json: modifiedState,
      p_area_sel: null,
      p_width: 20,
      p_length: 40,
      p_satellite: false,
      p_opacity: 0.8,
    });
    assertNoError(saveErr, "save_track modifiziert");

    // Wiederherstellen
    const { error: restoreErr } = await client.rpc("restore_track_version", { p_version_id: versionId });
    assertNoError(restoreErr, "restore_track_version");

    // Track muss wieder den initialen Zustand haben — alle Felder prüfen
    const { data: track, error: fetchErr } = await client
      .from("tracks")
      .select("state_json, manual_width, manual_length, map_satellite, map_opacity")
      .eq("id", trackId)
      .single();
    assertNoError(fetchErr, "fetch nach restore");
    const stateJson = track!.state_json as { items: Array<{ x: number; y: number }> };
    expect(stateJson.items[0].x).toBe(1);
    expect(stateJson.items[0].y).toBe(1);
    expect(track!.manual_width).toBe(18);
    expect(track!.manual_length).toBe(36);
    expect(track!.map_satellite).toBe(false);
    expect(Number(track!.map_opacity)).toBeCloseTo(0.5);
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

  it("restore_track_version stellt area_sel_json korrekt wieder her", async () => {
    const mockAreaSel = { widthM: 80, heightM: 40, centerLat: 50.517, centerLng: 7.317, zoom: 17 };

    // Zustand mit area_sel speichern und Snapshot anlegen
    await client.rpc("save_track", {
      p_track_id: trackId, p_state_json: initialState,
      p_area_sel: mockAreaSel, p_width: 18, p_length: 36, p_satellite: false, p_opacity: 0.5,
    });
    const { data: areaVId, error: createErr } = await client.rpc("create_track_version", { p_track_id: trackId });
    assertNoError(createErr, "create area_sel version");

    // area_sel leeren (Zustand ändern)
    await client.rpc("save_track", {
      p_track_id: trackId, p_state_json: modifiedState,
      p_area_sel: null, p_width: 20, p_length: 40, p_satellite: false, p_opacity: 0.8,
    });

    // Wiederherstellen
    const { error: restErr } = await client.rpc("restore_track_version", { p_version_id: areaVId as string });
    assertNoError(restErr, "restore area_sel version");

    // area_sel_json muss den ursprünglichen Wert haben
    const { data: track, error: fetchErr } = await client
      .from("tracks")
      .select("area_sel_json")
      .eq("id", trackId)
      .single();
    assertNoError(fetchErr, "fetch area_sel nach restore");
    expect(track!.area_sel_json).toMatchObject({ widthM: 80, heightM: 40 });
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

describe("Versionshistorie — Satellite-Gate beim Restore (Pro→Free)", () => {
  let client: Awaited<ReturnType<typeof loginAsUser>>;
  const userIds: string[] = [];
  let userId: string;
  let trackId: string;
  let versionWithSatelliteId: string;
  let versionWithoutSatelliteId: string;

  beforeAll(async () => {
    const email = `int-version-sat-${ts()}@test.invalid`;
    const user = await createTestUser(email, "pro");
    userId = user.id;
    userIds.push(user.id);
    client = await loginAsUser(email);

    const { data: tid } = await client.rpc("create_track", { track_name: "Satellite-Gate-Test" });
    trackId = tid as string;

    // Snapshot 1: ohne Satellite (bleibt auch nach Downgrade wiederherstellbar)
    await client.rpc("save_track", {
      p_track_id: trackId,
      p_state_json: { items: [], arrows: [] },
      p_area_sel: null, p_width: 18, p_length: 36, p_satellite: false, p_opacity: 0.5,
    });
    const { data: v1 } = await client.rpc("create_track_version", { p_track_id: trackId });
    versionWithoutSatelliteId = v1 as string;

    // Snapshot 2: mit Satellite (Pro-Feature, darf nach Downgrade nicht restauriert werden)
    await client.rpc("save_track", {
      p_track_id: trackId,
      p_state_json: { items: [], arrows: [] },
      p_area_sel: null, p_width: 20, p_length: 40, p_satellite: true, p_opacity: 0.7,
    });
    const { data: v2 } = await client.rpc("create_track_version", { p_track_id: trackId });
    versionWithSatelliteId = v2 as string;

    // User auf Free downgraden — ab hier kein Snapshot-Erstellen mehr möglich
    await admin.from("profiles").update({ tier: "free" }).eq("id", userId);
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  it("Restore eines Satellite-Snapshots schlägt für Free-User fehl", async () => {
    const { error } = await client.rpc("restore_track_version", { p_version_id: versionWithSatelliteId });
    assertRpcError(error, "satellite_requires_pro", "restore satellite als Free-User");
  });

  it("Restore eines Nicht-Satellite-Snapshots gelingt für Free-User", async () => {
    const { error } = await client.rpc("restore_track_version", { p_version_id: versionWithoutSatelliteId });
    assertNoError(error, "restore non-satellite als Free-User");

    const { data: track } = await client
      .from("tracks")
      .select("manual_width, manual_length, map_satellite")
      .eq("id", trackId)
      .single();
    expect(track?.manual_width).toBe(18);
    expect(track?.manual_length).toBe(36);
    expect(track?.map_satellite).toBe(false);
  });
});

describe("Versionshistorie — Race-Lock (parallele Snapshots)", () => {
  let client: Awaited<ReturnType<typeof loginAsUser>>;
  const userIds: string[] = [];
  let trackId: string;

  beforeAll(async () => {
    const email = `int-version-race-${ts()}@test.invalid`;
    const user = await createTestUser(email, "pro");
    userIds.push(user.id);
    client = await loginAsUser(email);
    const { data } = await client.rpc("create_track", { track_name: "Race-Test" });
    trackId = data as string;
    await client.rpc("save_track", {
      p_track_id: trackId, p_state_json: { items: [], arrows: [] },
      p_area_sel: null, p_width: 18, p_length: 36, p_satellite: false, p_opacity: 0.5,
    });
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  it("parallele create_track_version-Aufrufe erzeugen eindeutige Versionsnummern", async () => {
    const [r1, r2] = await Promise.all([
      client.rpc("create_track_version", { p_track_id: trackId }),
      client.rpc("create_track_version", { p_track_id: trackId }),
    ]);
    assertNoError(r1.error, "parallel create 1");
    assertNoError(r2.error, "parallel create 2");

    const { data: versions } = await client.rpc("get_track_versions", { p_track_id: trackId });
    expect(versions).toHaveLength(2);
    const nums = (versions as Array<{ version_number: number }>).map((v) => v.version_number);
    // Keine Duplikate — FOR UPDATE verhindert Race Condition
    expect(new Set(nums).size).toBe(2);
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

describe("Versionshistorie — Speichern unter (create_track_from_version)", () => {
  let client: Awaited<ReturnType<typeof loginAsUser>>;
  const userIds: string[] = [];
  let trackId: string;
  let versionId: string;

  const snapshotState = {
    items: [{ id: "f1", key: "singlePylon", x: 3, y: 4, rotationDeg: 0, direction: "none" }],
    arrows: [],
  };
  const mockAreaSel = { widthM: 80, heightM: 40, centerLat: 50.517, centerLng: 7.317, zoom: 17 };

  beforeAll(async () => {
    const email = `int-saveas-pro-${ts()}@test.invalid`;
    const user = await createTestUser(email, "pro");
    userIds.push(user.id);
    client = await loginAsUser(email);

    const { data } = await client.rpc("create_track", { track_name: "Save-As-Quelle" });
    trackId = data as string;
    await client.rpc("save_track", {
      p_track_id: trackId, p_state_json: snapshotState,
      p_area_sel: mockAreaSel, p_width: 22, p_length: 44, p_satellite: false, p_opacity: 0.6,
    });
    const { data: vid } = await client.rpc("create_track_version", { p_track_id: trackId });
    versionId = vid as string;

    // Ursprungstrack danach verändern — Save-As muss diesen NICHT beeinflussen
    await client.rpc("save_track", {
      p_track_id: trackId, p_state_json: { items: [], arrows: [] },
      p_area_sel: null, p_width: 30, p_length: 50, p_satellite: false, p_opacity: 0.9,
    });
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  it("legt einen neuen, eigenständigen Track mit dem Snapshot-Inhalt an", async () => {
    const { data: newId, error } = await client.rpc("create_track_from_version", {
      p_version_id: versionId,
      p_name: "Kopie von Save-As-Quelle",
    });
    assertNoError(error, "create_track_from_version");
    expect(newId).toMatch(/^[0-9a-f-]{36}$/);
    expect(newId).not.toBe(trackId);

    const { data: newTrack, error: fetchErr } = await client
      .from("tracks")
      .select("name, state_json, area_sel_json, manual_width, manual_length, map_satellite, map_opacity")
      .eq("id", newId as string)
      .single();
    assertNoError(fetchErr, "fetch neuer Track");
    expect(newTrack!.name).toBe("Kopie von Save-As-Quelle");
    const stateJson = newTrack!.state_json as { items: Array<{ x: number; y: number }> };
    expect(stateJson.items[0].x).toBe(3);
    expect(stateJson.items[0].y).toBe(4);
    expect(newTrack!.area_sel_json).toMatchObject({ widthM: 80, heightM: 40 });
    expect(newTrack!.manual_width).toBe(22);
    expect(newTrack!.manual_length).toBe(44);
    expect(newTrack!.map_satellite).toBe(false);
    expect(Number(newTrack!.map_opacity)).toBeCloseTo(0.6);

    // Kern-Anforderung: der Ursprungstrack bleibt vom Save-As unberührt
    const { data: originalTrack, error: origErr } = await client
      .from("tracks")
      .select("name, state_json, manual_width, manual_length")
      .eq("id", trackId)
      .single();
    assertNoError(origErr, "fetch Ursprungstrack nach Save-As");
    expect(originalTrack!.name).toBe("Save-As-Quelle");
    expect(originalTrack!.manual_width).toBe(30);
    expect(originalTrack!.manual_length).toBe(50);
    const origState = originalTrack!.state_json as { items: unknown[] };
    expect(origState.items).toHaveLength(0);
  });

  it("leerer/Whitespace-Name fällt auf 'Neue Strecke' zurück statt zu scheitern", async () => {
    const { data: newId, error } = await client.rpc("create_track_from_version", {
      p_version_id: versionId,
      p_name: "   ",
    });
    assertNoError(error, "create_track_from_version leerer Name");
    const { data: newTrack } = await client
      .from("tracks").select("name").eq("id", newId as string).single();
    expect(newTrack!.name).toBe("Neue Strecke");
  });

  it("Name über 100 Zeichen schlägt mit invalid_name fehl", async () => {
    const tooLong = "x".repeat(101);
    const { error } = await client.rpc("create_track_from_version", {
      p_version_id: versionId,
      p_name: tooLong,
    });
    assertRpcError(error, "invalid_name", "create_track_from_version Name zu lang");
  });

  it("Name mit genau 100 Zeichen wird akzeptiert (Grenzfall)", async () => {
    const exactly100 = "y".repeat(100);
    const { data: newId, error } = await client.rpc("create_track_from_version", {
      p_version_id: versionId,
      p_name: exactly100,
    });
    assertNoError(error, "create_track_from_version Name genau 100 Zeichen");
    const { data: newTrack } = await client
      .from("tracks").select("name").eq("id", newId as string).single();
    expect(newTrack!.name).toBe(exactly100);
  });
});

describe("Versionshistorie — Speichern unter: gelöschter Account", () => {
  let client: Awaited<ReturnType<typeof loginAsUser>>;
  const userIds: string[] = [];
  let userId: string;
  let versionId: string;

  beforeAll(async () => {
    const email = `int-saveas-deleted-${ts()}@test.invalid`;
    const user = await createTestUser(email, "pro");
    userId = user.id;
    userIds.push(user.id);
    client = await loginAsUser(email);

    const { data: tid } = await client.rpc("create_track", { track_name: "Deleted-Account-Test" });
    await client.rpc("save_track", {
      p_track_id: tid as string, p_state_json: { items: [], arrows: [] },
      p_area_sel: null, p_width: 18, p_length: 36, p_satellite: false, p_opacity: 0.5,
    });
    const { data: vid } = await client.rpc("create_track_version", { p_track_id: tid as string });
    versionId = vid as string;

    // Account als gelöscht markieren — is_deleted-Prüfung muss danach greifen
    await admin.from("profiles").update({ is_deleted: true }).eq("id", userId);
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  it("create_track_from_version schlägt für gelöschten Account fehl", async () => {
    const { error } = await client.rpc("create_track_from_version", {
      p_version_id: versionId,
      p_name: "Sollte scheitern",
    });
    assertRpcError(error, "not_owner", "create_track_from_version gelöschter Account");
  });
});

describe("Versionshistorie — Speichern unter: Tier-Limit greift", () => {
  let client: Awaited<ReturnType<typeof loginAsUser>>;
  const userIds: string[] = [];
  let versionId: string;

  beforeAll(async () => {
    const email = `int-saveas-limit-${ts()}@test.invalid`;
    const user = await createTestUser(email, "pro");
    userIds.push(user.id);
    client = await loginAsUser(email);

    const { data: tid } = await client.rpc("create_track", { track_name: "Limit-Quelle" });
    const { data: vid } = await client.rpc("create_track_version", { p_track_id: tid as string });
    versionId = vid as string;

    // Pro-Limit ist 50 Tracks — der erste zählt bereits, 49 weitere bis zum Limit anlegen
    for (let i = 0; i < 49; i++) {
      const { error } = await client.rpc("create_track", { track_name: `Limit-Filler ${i}` });
      assertNoError(error, `create_track filler ${i}`);
    }
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  it("create_track_from_version schlägt bei erreichtem Tier-Limit fehl", async () => {
    const { error } = await client.rpc("create_track_from_version", {
      p_version_id: versionId,
      p_name: "Sollte scheitern",
    });
    assertRpcError(error, "track_limit_reached", "create_track_from_version am Limit");
  });
});

describe("Versionshistorie — Speichern unter: Tier-Limit ist race-sicher (FOR UPDATE)", () => {
  let client: Awaited<ReturnType<typeof loginAsUser>>;
  const userIds: string[] = [];
  let versionId: string;

  beforeAll(async () => {
    const email = `int-saveas-race-${ts()}@test.invalid`;
    const user = await createTestUser(email, "pro");
    userIds.push(user.id);
    client = await loginAsUser(email);

    const { data: tid } = await client.rpc("create_track", { track_name: "Race-Quelle" });
    const { data: vid } = await client.rpc("create_track_version", { p_track_id: tid as string });
    versionId = vid as string;

    // Genau 1 unter dem Pro-Limit (50) — die Quelle zählt bereits, 48 weitere anlegen (49 total)
    for (let i = 0; i < 48; i++) {
      const { error } = await client.rpc("create_track", { track_name: `Race-Filler ${i}` });
      assertNoError(error, `create_track filler ${i}`);
    }
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  it("zwei parallele create_track_from_version-Aufrufe am Limit erzeugen nicht mehr als 50 Tracks", async () => {
    const [r1, r2] = await Promise.all([
      client.rpc("create_track_from_version", { p_version_id: versionId, p_name: "Race A" }),
      client.rpc("create_track_from_version", { p_version_id: versionId, p_name: "Race B" }),
    ]);
    const results = [r1, r2];
    const successes = results.filter((r) => !r.error);
    const failures = results.filter((r) => r.error);
    // FOR UPDATE serialisiert die beiden Aufrufe — genau einer darf noch
    // unter das Limit von 50 fallen, der andere muss track_limit_reached sehen.
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    assertRpcError(failures[0].error, "track_limit_reached", "paralleler create_track_from_version am Limit");

    const { data: allTracks, error: countErr } = await client.from("tracks").select("id");
    assertNoError(countErr, "Tracks nach Race zählen");
    expect(allTracks).toHaveLength(50);
  });
});

describe("Track-Limit ist race-sicher für create_track (FOR UPDATE)", () => {
  let client: Awaited<ReturnType<typeof loginAsUser>>;
  const userIds: string[] = [];

  beforeAll(async () => {
    const email = `int-createtrack-race-${ts()}@test.invalid`;
    const user = await createTestUser(email, "free");
    userIds.push(user.id);
    client = await loginAsUser(email);

    // Free-Limit ist 3 — 2 Tracks anlegen, damit der nächste Aufruf am Limit steht
    await client.rpc("create_track", { track_name: "Filler 1" });
    await client.rpc("create_track", { track_name: "Filler 2" });
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  it("zwei parallele create_track-Aufrufe am Limit erzeugen nicht mehr als 3 Tracks", async () => {
    const [r1, r2] = await Promise.all([
      client.rpc("create_track", { track_name: "Race A" }),
      client.rpc("create_track", { track_name: "Race B" }),
    ]);
    const results = [r1, r2];
    const successes = results.filter((r) => !r.error);
    const failures = results.filter((r) => r.error);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    assertRpcError(failures[0].error, "track_limit_reached", "paralleler create_track am Limit");

    const { data: allTracks, error: countErr } = await client.from("tracks").select("id");
    assertNoError(countErr, "Tracks nach Race zählen");
    expect(allTracks).toHaveLength(3);
  });
});

describe("Versionshistorie — Speichern unter: Satellite-Gate (Pro→Free)", () => {
  let client: Awaited<ReturnType<typeof loginAsUser>>;
  const userIds: string[] = [];
  let userId: string;
  let versionWithSatelliteId: string;
  let versionWithoutSatelliteId: string;

  beforeAll(async () => {
    const email = `int-saveas-sat-${ts()}@test.invalid`;
    const user = await createTestUser(email, "pro");
    userId = user.id;
    userIds.push(user.id);
    client = await loginAsUser(email);

    const { data: tid } = await client.rpc("create_track", { track_name: "Satellite-SaveAs-Test" });
    const trackId = tid as string;

    await client.rpc("save_track", {
      p_track_id: trackId, p_state_json: { items: [], arrows: [] },
      p_area_sel: null, p_width: 18, p_length: 36, p_satellite: false, p_opacity: 0.5,
    });
    const { data: v1 } = await client.rpc("create_track_version", { p_track_id: trackId });
    versionWithoutSatelliteId = v1 as string;

    await client.rpc("save_track", {
      p_track_id: trackId, p_state_json: { items: [], arrows: [] },
      p_area_sel: null, p_width: 20, p_length: 40, p_satellite: true, p_opacity: 0.7,
    });
    const { data: v2 } = await client.rpc("create_track_version", { p_track_id: trackId });
    versionWithSatelliteId = v2 as string;

    // Downgrade auf Free — der Ursprungstrack + 1 Snapshot-Track zählen gegen das Free-Limit (3)
    await admin.from("profiles").update({ tier: "free" }).eq("id", userId);
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  it("Save-As eines Satellite-Snapshots schlägt für Free-User fehl", async () => {
    const { error } = await client.rpc("create_track_from_version", {
      p_version_id: versionWithSatelliteId,
      p_name: "Satellite-Kopie",
    });
    assertRpcError(error, "satellite_requires_pro", "create_track_from_version satellite als Free-User");
  });

  it("Save-As eines Nicht-Satellite-Snapshots gelingt für Free-User", async () => {
    const { data: newId, error } = await client.rpc("create_track_from_version", {
      p_version_id: versionWithoutSatelliteId,
      p_name: "Non-Satellite-Kopie",
    });
    assertNoError(error, "create_track_from_version non-satellite als Free-User");
    const { data: newTrack } = await client
      .from("tracks").select("map_satellite").eq("id", newId as string).single();
    expect(newTrack?.map_satellite).toBe(false);
  });
});

describe("Versionshistorie — Speichern unter: RLS Fremdzugriff", () => {
  let clientA: Awaited<ReturnType<typeof loginAsUser>>;
  let clientB: Awaited<ReturnType<typeof loginAsUser>>;
  const userIds: string[] = [];
  let versionIdA: string;

  beforeAll(async () => {
    const emailA = `int-saveas-rls-a-${ts()}@test.invalid`;
    const emailB = `int-saveas-rls-b-${ts()}@test.invalid`;
    const userA = await createTestUser(emailA, "pro");
    const userB = await createTestUser(emailB, "pro");
    userIds.push(userA.id, userB.id);
    clientA = await loginAsUser(emailA);
    clientB = await loginAsUser(emailB);

    const { data: tid } = await clientA.rpc("create_track", { track_name: "RLS-SaveAs-A" });
    await clientA.rpc("save_track", {
      p_track_id: tid as string, p_state_json: { items: [], arrows: [] },
      p_area_sel: null, p_width: 18, p_length: 36, p_satellite: false, p_opacity: 0.5,
    });
    const { data: vid } = await clientA.rpc("create_track_version", { p_track_id: tid as string });
    versionIdA = vid as string;
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  it("User B kann aus einer Version von User A keinen Track anlegen", async () => {
    const { error } = await clientB.rpc("create_track_from_version", {
      p_version_id: versionIdA,
      p_name: "Fremdzugriff-Versuch",
    });
    assertRpcError(error, "not_owner", "create_track_from_version fremde Version");
  });
});
