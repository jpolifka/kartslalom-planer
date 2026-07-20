// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// Integration: Track-Lifecycle gegen echte lokale Supabase.
// create_track → save_track → fetch → fetch-by-id → delete → weg
//
// Deckt den kompletten Lebenszyklus einer Strecke ab: Anlegen, Umbenennen,
// Speichern (inkl. serverseitiger Namens-/Payload-Validierung), Lesen des
// gespeicherten State, Tier-Gates für Premium-Kartenanbieter (map_provider_id)
// und schließlich Löschen. Läuft gegen die echte DB, weil die Validierung
// (invalid_name, map_provider_requires_pro, track_limit_reached) serverseitig
// in den RPCs sitzt und nicht im Frontend gemockt werden kann.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestUser, loginAsUser, cleanupUsers, admin,
  assertNoError, assertRpcError, ts,
} from "./helpers";

describe("Track lifecycle", () => {
  let client: Awaited<ReturnType<typeof loginAsUser>>;
  const userIds: string[] = [];
  let userId: string;
  let trackId: string;

  beforeAll(async () => {
    const email = `int-track-${ts()}@test.invalid`;
    const user = await createTestUser(email);
    userId = user.id;
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

  it("create_track schlägt mit invalid_name bei Namen über 100 Zeichen fehl", async () => {
    const { error } = await client.rpc("create_track", { track_name: "x".repeat(101) });
    assertRpcError(error, "invalid_name", "create_track Name zu lang");
  });

  it("rename_track schlägt mit invalid_name bei Namen über 100 Zeichen fehl", async () => {
    const { error } = await client.rpc("rename_track", { p_track_id: trackId, p_name: "y".repeat(101) });
    assertRpcError(error, "invalid_name", "rename_track Name zu lang");
  });

  it("rename_track akzeptiert einen Namen mit genau 100 Zeichen", async () => {
    const exactly100 = "z".repeat(100);
    const { error } = await client.rpc("rename_track", { p_track_id: trackId, p_name: exactly100 });
    assertNoError(error, "rename_track Name genau 100 Zeichen");
    const { data } = await client.from("tracks").select("name").eq("id", trackId).single();
    expect(data!.name).toBe(exactly100);
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
      p_map_provider_id: "osm",
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

  it("save_track schlägt fehl mit map_provider_requires_pro für Free-User", async () => {
    // Explizit free setzen — Schema-Default ist vorübergehend 'pro' (Übergangspolitik vor Rollout)
    const { error: tierErr } = await admin.from("profiles").update({ tier: "free" }).eq("id", userId);
    assertNoError(tierErr, "tier auf free setzen");

    const { error } = await client.rpc("save_track", {
      p_track_id:   trackId,
      p_state_json: { items: [], arrows: [] },
      p_area_sel:   null,
      p_width:      18,
      p_length:     36,
      p_map_provider_id: "rlp_dop20",
      p_opacity:    0.5,
    });
    assertRpcError(error, "map_provider_requires_pro", "save_track premium provider free");
  });

  it("save_track erlaubt Premium-Provider für Pro-User", async () => {
    const { error: tierErr } = await admin.from("profiles").update({ tier: "pro" }).eq("id", userId);
    assertNoError(tierErr, "tier auf pro setzen");

    const { error } = await client.rpc("save_track", {
      p_track_id:   trackId,
      p_state_json: { items: [], arrows: [] },
      p_area_sel:   null,
      p_width:      18,
      p_length:     36,
      p_map_provider_id: "rlp_dop20",
      p_opacity:    0.5,
    });
    assertNoError(error, "save_track premium provider pro");

    // Zurück auf free — create_track-Limit-Test braucht free-Tier
    await admin.from("profiles").update({ tier: "free" }).eq("id", userId);
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

// Szenario: Custom Formation mit Snapshot wird in Track gespeichert.
// Nach Löschen der Quell-Formation muss der Snapshot in der DB erhalten bleiben.
// customSnapshot ist bewusst eine Kopie der Formationsdaten zum Zeitpunkt des
// Platzierens, keine Referenz (customFormationId zeigt zwar noch auf die
// Quelle, wird aber nicht mehr aufgelöst) — deshalb reicht es hier zu prüfen,
// dass state_json den Snapshot unverändert durch mehrfaches save_track
// hindurch persistiert, ohne dass die referenzierte Quell-Formation überhaupt
// noch existieren muss.
describe("customSnapshot DB-Persistenz", () => {
  let client: Awaited<ReturnType<typeof loginAsUser>>;
  const userIds: string[] = [];
  let trackId: string;

  const snap = {
    cones: [{ id: "c1", x: 0, y: 1, kind: "standing", angleDeg: 0 }],
    arrows: [{ id: "a1", x1: 0, y1: 0, x2: 1, y2: 1 }],
    label: "Test-Slalom-Bogen",
  };

  beforeAll(async () => {
    const email = `int-snap-${ts()}@test.invalid`;
    const user = await createTestUser(email);
    userIds.push(user.id);
    client = await loginAsUser(email);
    const { data } = await client.rpc("create_track", { track_name: "Snapshot-Test" });
    trackId = data as string;
  });

  afterAll(async () => {
    await cleanupUsers(userIds);
  });

  it("save_track speichert customSnapshot in state_json", async () => {
    const state = {
      items: [{
        id: "pf1", key: "custom",
        x: 5, y: 10, rotationDeg: 45, direction: "none",
        customFormationId: "cf-source-deleted-later",
        customSnapshot: snap,
      }],
      arrows: [],
    };
    const { error } = await client.rpc("save_track", {
      p_track_id:   trackId,
      p_state_json: state,
      p_area_sel:   null,
      p_width:      18,
      p_length:     36,
      p_map_provider_id: "osm",
      p_opacity:    0.5,
    });
    assertNoError(error, "save_track mit customSnapshot");
  });

  it("fetchTrack gibt customSnapshot vollständig zurück", async () => {
    const { data, error } = await client
      .from("tracks")
      .select("state_json")
      .eq("id", trackId)
      .single();
    assertNoError(error, "fetch state_json");

    const stateJson = data!.state_json as { items: Array<Record<string, unknown>> };
    expect(stateJson.items).toHaveLength(1);
    const item = stateJson.items[0];
    expect(item.key).toBe("custom");
    expect(item.customSnapshot).toEqual(snap);
    expect(item.customFormationId).toBe("cf-source-deleted-later");
  });

  it("Snapshot bleibt auch nach erneutem save_track (anderer State obendrüber) erhalten", async () => {
    // Zweiter Speichervorgang mit anderem Track — stellt sicher, dass kein update den Snapshot löscht
    await client.rpc("save_track", {
      p_track_id:   trackId,
      p_state_json: {
        items: [{
          id: "pf1", key: "custom",
          x: 99, y: 88, rotationDeg: 0, direction: "cw",
          customFormationId: "cf-source-deleted-later",
          customSnapshot: snap,
        }],
        arrows: [],
      },
      p_area_sel:   null,
      p_width:      20,
      p_length:     40,
      p_map_provider_id: "osm",
      p_opacity:    0.8,
    });

    const { data, error } = await client
      .from("tracks")
      .select("state_json")
      .eq("id", trackId)
      .single();
    assertNoError(error, "fetch nach zweitem save");

    const item = (data!.state_json as { items: Array<Record<string, unknown>> }).items[0];
    expect(item.customSnapshot).toEqual(snap);
    expect(item.x).toBe(99);
  });
});
